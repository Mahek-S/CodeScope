"""
Celery tasks for the indexing pipeline.

Both the manual sync task and the push-event task run the same full
index (see indexing_service.index_repository) — see that module's
docstring for why push events re-clone rather than diff.
"""

import logging
from datetime import datetime, timezone

from database import SessionLocal
from models.project import Project
from services.indexing_service import IndexingError, index_repository
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_full_index(project_id: str) -> dict:
    """Shared implementation: load the project, index it, update indexed_at."""
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            logger.warning("Indexing skipped: project %s not found", project_id)
            return {"status": "skipped", "reason": "project not found", "project_id": project_id}

        result = index_repository(db, project)
        project.indexed_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(
            "Indexed project %s: %s files, %s dependency edges",
            project_id, result["files_indexed"], result["dependency_edges"],
        )
        return {"status": "completed", "project_id": project_id, **result}
    finally:
        db.close()


@celery_app.task(name="indexing.parse_repository", bind=True, max_retries=3)
def parse_repository(self, project_id: str):
    """
    Full index: clone the repo, AST-parse every Python file, and rebuild
    the file-level dependency graph. Triggered by manual sync.
    """
    try:
        return _run_full_index(project_id)
    except IndexingError as e:
        logger.error("Indexing failed for project %s: %s", project_id, e)
        raise self.retry(exc=e, countdown=30)


@celery_app.task(name="indexing.generate_embeddings", bind=True, max_retries=3)
def generate_embeddings(self, project_id: str):
    """
    Generate sentence-transformer embeddings for all indexed files
    and store them in pgvector.
    Implemented Day 4.
    """
    # TODO Day 4
    return {"status": "queued", "project_id": project_id}


@celery_app.task(name="indexing.process_push_event", bind=True, max_retries=3)
def process_push_event(self, project_id: str, commit_sha: str, changed_files: list):
    """
    Re-index the repo after a push event. Runs the same full index as
    manual sync — see indexing_service.index_repository's docstring for
    why a full re-clone is preferred over diffing changed_files here.
    """
    try:
        result = _run_full_index(project_id)
        return {**result, "commit_sha": commit_sha, "trigger_changed_files": changed_files}
    except IndexingError as e:
        logger.error(
            "Push-triggered indexing failed for project %s (commit %s): %s",
            project_id, commit_sha, e,
        )
        raise self.retry(exc=e, countdown=30)