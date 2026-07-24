"""
Triggers and stores LangGraph impact analyses.

trigger_analysis is the single entrypoint used by both paths that can
kick off an analysis:
  - the GitHub webhook, when a PR is opened (routers/webhooks.py)
  - the manual "POST /projects/{id}/analyses" endpoint (routers/analyses.py)

Both go through the Celery task in workers/analysis_tasks.py, so this
module is synchronous and safe to call from a worker process — it opens
its own event loop (via asyncio.run) to drive the async LangGraph graph.
"""
import asyncio
import logging

from sqlalchemy.orm import Session

from ai.workflow import impact_analysis_graph
from models.analysis import Analysis
from models.project import Project
from models.pull_request import PullRequest
from services.github_service import GitHubService
from services.indexing_service import get_repo_access_token

logger = logging.getLogger(__name__)


NOISE_EXTENSIONS = {
    ".zip", ".tar", ".gz", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".pdf",
}
NOISE_FILENAMES = {"readme.md", "license", "license.md", ".gitignore", ".gitattributes"}


def _is_noise_file(filepath: str) -> bool:
    """
    Filter for files that shouldn't count toward impact analysis at all --
    binary assets and pure repo metadata. Deliberately NOT excluding
    requirements.txt, Dockerfiles, or config/YAML files -- those are real
    signal (a dependency bump or config change is meaningful risk), unlike
    a committed zip archive or a README edit.
    """
    lower = filepath.lower()
    filename = lower.rsplit("/", 1)[-1]
    if any(lower.endswith(ext) for ext in NOISE_EXTENSIONS):
        return True
    if filename in NOISE_FILENAMES:
        return True
    if lower.startswith(".github/"):
        return True
    return False


def _resolve_pr_files(
    db: Session, project: Project, pr_number: int
) -> tuple[list[str], int]:
    """
    Fetch changed filenames and total diff size for a PR directly from
    GitHub. Always hits the API rather than trusting a stored
    PullRequest.changed_files — that column is only populated by this
    same function, and diff size isn't persisted anywhere, so there's no
    cache to fall back to that would actually save a call.
    """
    access_token = get_repo_access_token(db, project)
    github = GitHubService(access_token)

    files = [f for f in github.get_pr_files(project.repo_full_name, pr_number) if not _is_noise_file(f.filename)]
    changed_files = [f.filename for f in files]
    diff_size = sum(f.additions + f.deletions for f in files)
    
    return changed_files, diff_size


def _sync_pull_request_row(
    db: Session, project: Project, pr_number: int, changed_files: list[str]
) -> None:
    """Keep the stored PullRequest.changed_files in sync now that we have
    the real list from GitHub (the webhook only stages an empty list)."""
    pr_row = (
        db.query(PullRequest)
        .filter(
            PullRequest.project_id == project.id,
            PullRequest.pr_number == pr_number,
        )
        .first()
    )
    if pr_row:
        pr_row.changed_files = changed_files


def trigger_analysis(
    db: Session,
    project: Project,
    pr_number: int,
    trigger: str = "manual",
) -> Analysis:
    """
    Run the full LangGraph impact analysis workflow for one PR and
    persist the result.

    Returns the created Analysis row. Raises whatever the GitHub API or
    the graph raises — the caller (a Celery task) is responsible for
    retry/rollback handling.
    """
    changed_files, diff_size = _resolve_pr_files(db, project, pr_number)

    if not changed_files:
        logger.warning(
            "No changed files found for %s PR #%s — analysis will report zero impact",
            project.repo_full_name, pr_number,
        )

    _sync_pull_request_row(db, project, pr_number, changed_files)

    initial_state = {
        "project_id": str(project.id),
        "pr_number": pr_number,
        "changed_files": changed_files,
        "diff_size": diff_size,
        "directly_affected": [],
        "transitively_affected": [],
        "risk_score": 0.0,
        "risk_level": "low",
        "similar_bugs": [],
        "explanation": "",
        "heuristic_test_files": [],
        "llm_testing_areas": [],
        "suggested_tests": [],
        "comment_markdown": "",
        "github_comment_id": None,
        "raw_llm_output": "",
    }

    final_state = asyncio.run(impact_analysis_graph.ainvoke(initial_state))

    suggested_tests = sorted(
        set(final_state["llm_testing_areas"]) | set(final_state["heuristic_test_files"])
    )[:10]

    analysis = Analysis(
        project_id=project.id,
        pr_number=pr_number,
        trigger=trigger,
        changed_files=final_state["changed_files"],
        directly_affected=final_state["directly_affected"],
        transitively_affected=final_state["transitively_affected"],
        similar_past_bugs={"items": final_state["similar_bugs"]},
        suggested_tests=final_state["suggested_tests"],
        risk_score=final_state["risk_score"],
        risk_level=final_state["risk_level"],
        explanation=final_state["explanation"],
        raw_llm_output=final_state["raw_llm_output"],
        github_comment_id=final_state.get("github_comment_id"),
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    return analysis