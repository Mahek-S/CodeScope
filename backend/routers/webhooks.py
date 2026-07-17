# routers/webhooks.py
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from config import settings
from database import get_db
from models.project import Project
from models.commit import Commit
from models.pull_request import PullRequest
from utils.security import verify_github_signature
from workers.analysis_tasks import run_impact_analysis
from workers.indexing_tasks import process_push_event
from models.webhook_delivery import WebhookDelivery

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

PR_ACTIONS_TO_PERSIST = {"opened", "synchronize", "reopened", "closed"}


@router.post("/github")
async def github_webhook(request: Request, db: Session = Depends(get_db)):
    payload_body = await request.body()
    event_type = request.headers.get("X-GitHub-Event")
    signature = request.headers.get("X-Hub-Signature-256")
    payload = await request.json()

    github_repo_id = payload.get("repository", {}).get("id")
    project = db.query(Project).filter(Project.github_repo_id == github_repo_id).first()
    if not project:
        return {"status": "ignored", "reason": "unknown repository"}

    if not verify_github_signature(payload_body=payload_body,secret=settings.github_webhook_secret,signature_header=signature):
        raise HTTPException(401, "Invalid webhook signature")

    if not verify_github_signature(payload_body=payload_body,secret=settings.github_webhook_secret,signature_header=signature):
        raise HTTPException(401, "Invalid webhook signature")

    # GitHub retries deliveries that time out or 5xx, reusing the same
    # X-GitHub-Delivery ID. Recording it here — after signature
    # verification, so an unsigned request can't burn a legitimate
    # delivery ID — turns a retry into a cheap no-op instead of a
    # duplicate Commit/PullRequest upsert or a duplicate Analysis.
    delivery_id = request.headers.get("X-GitHub-Delivery")
    if delivery_id:
        insert_result = db.execute(
            pg_insert(WebhookDelivery)
            .values(delivery_id=delivery_id)
            .on_conflict_do_nothing(index_elements=["delivery_id"])
        )
        if insert_result.rowcount == 0:
            db.rollback()
            return {"status": "ignored", "reason": "duplicate delivery"}

    current_full_name = payload["repository"]["full_name"]
    if project.repo_full_name != current_full_name:
        project.repo_full_name = current_full_name  # staged, not committed yet

    push_details = None
    pr_opened_number = None
    if event_type == "push":
        push_details = _stage_push_event(db, project, payload)
    elif event_type == "pull_request":
        pr_opened_number = _stage_pull_request_event(db, project, payload)
    else:
        return {"status": "ignored", "reason": f"unhandled event type: {event_type}"}

    db.commit()  # single commit point — everything staged above lands atomically

    # Enqueue background work only after the commit succeeds, so a task
    # never runs against a webhook payload that failed to persist.
    if push_details:
        sha, changed_files = push_details
        process_push_event.delay(str(project.id), sha, changed_files)

    if pr_opened_number is not None:
        # Change Impact Analysis is triggered specifically on "PR opened"
        # (see spec) — synchronize/reopened/closed are persisted above
        # but don't kick off a fresh analysis.
        run_impact_analysis.delay(str(project.id), pr_opened_number, "pr_opened")

    return {"status": "received"}


def _stage_push_event(db: Session, project: Project, payload: dict) -> tuple[str, list[str]] | None:
    """
    Build and execute the commit upsert. Does NOT commit.
    Returns (sha, changed_files) for the caller to enqueue indexing with,
    or None if the payload has no head commit to act on.
    """
    sha = payload.get("head_commit", {}).get("id")
    if not sha:
        return None

    changed = set()
    for commit in payload.get("commits", []):
        changed.update(commit.get("added", []))
        changed.update(commit.get("modified", []))
        changed.update(commit.get("removed", []))

    stmt = pg_insert(Commit).values(
        project_id=project.id,
        sha=sha,
        message=payload["head_commit"].get("message"),
        author_name=payload["head_commit"].get("author", {}).get("name"),
        author_email=payload["head_commit"].get("author", {}).get("email"),
        changed_files=list(changed),
        committed_at=payload["head_commit"].get("timestamp"),
    ).on_conflict_do_nothing(index_elements=["project_id", "sha"])

    db.execute(stmt)
    return sha, list(changed)


def _stage_pull_request_event(db: Session, project: Project, payload: dict) -> int | None:
    """
    Build and execute the PR upsert. Does NOT commit.

    Returns the PR number if this action should trigger a fresh impact
    analysis (currently just "opened" — see the AI Feature spec), else
    None.
    """
    action = payload.get("action")
    if action not in PR_ACTIONS_TO_PERSIST:
        return None

    pr_data = payload["pull_request"]

    stmt = pg_insert(PullRequest).values(
        project_id=project.id,
        pr_number=pr_data["number"],
        title=pr_data["title"],
        author=pr_data["user"]["login"],
        changed_files=[],  # populated by analysis_service once an analysis runs
        base_branch=pr_data["base"]["ref"],
        head_branch=pr_data["head"]["ref"],
        opened_at=pr_data["created_at"],
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["project_id", "pr_number"],
        set_={
            "title": stmt.excluded.title,
            "base_branch": stmt.excluded.base_branch,
            "head_branch": stmt.excluded.head_branch,
        },
    )
    db.execute(stmt)

    return pr_data["number"] if action == "opened" else None