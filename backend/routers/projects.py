from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from dependencies.auth import get_current_user
from services.membership_service import require_admin
from models.project import Project
from schemas.project import ProjectCreateSchema
from services.github_service import GitHubService

router = APIRouter(tags=["projects"])


@router.get("/orgs/{org_id}/github-repos")
def list_available_repos(
    org_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_current_user(request, db)

    github = GitHubService(user.access_token)

    return github.list_user_repos()


@router.post("/orgs/{org_id}/projects")
def create_project(
    org_id: str,
    payload: ProjectCreateSchema,
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_current_user(request, db)
    require_admin(db, user.id, org_id)

    github = GitHubService(user.access_token)
    repo = github.get_repo(payload.repo_full_name)

    project = Project(
        org_id=org_id,
        name=payload.name,
        github_repo_id=repo["id"],
        repo_full_name=payload.repo_full_name,
        repo_url=payload.repo_url,
        default_branch=payload.default_branch or "main",
    )

    db.add(project)

    try:
        # Flush (not commit) so project.id exists, but nothing is
        # durable yet — if webhook creation fails below, rollback
        # actually discards the row instead of leaving an orphan.
        db.flush()

        webhook_url = f"{settings.public_base_url}/webhooks/github"

        # Single app-level secret (settings.github_webhook_secret) —
        # not a per-project secret. GitHub Apps verify all webhook
        # deliveries against one shared secret; there's nothing
        # per-project to generate or persist here.
        github.create_repo_webhook(
            repo_full_name=payload.repo_full_name,
            webhook_url=webhook_url,
            secret=settings.github_webhook_secret,
        )

        db.commit()
        db.refresh(project)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect GitHub repository: {str(e)}",
        )

    return {
        "id": str(project.id),
        "name": project.name,
        "repo_full_name": project.repo_full_name,
        "repo_url": project.repo_url,
        "default_branch": project.default_branch,
    }


@router.get("/orgs/{org_id}/projects")
def list_projects(
    org_id: str,
    db: Session = Depends(get_db),
):
    projects = (
        db.query(Project)
        .filter(Project.org_id == org_id)
        .all()
    )

    return projects


@router.get("/projects/{project_id}")
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    return project


@router.post("/projects/{project_id}/sync")
def sync_project(project_id: str):
    return {
        "detail": "Repository indexing will be implemented on Day 3."
    }