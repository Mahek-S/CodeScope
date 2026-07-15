"""
Celery tasks for the indexing pipeline.
Implemented fully on Day 3 (AST parsing, graph) and Day 4 (embeddings).
"""

from workers.celery_app import celery_app


@celery_app.task(name="indexing.parse_repository", bind=True, max_retries=3)
def parse_repository(self, project_id: str):
    """
    Clone/pull the repo, walk Python files, run AST parser,
    store FileNode records and Dependency edges.
    Implemented Day 3.
    """
    # TODO Day 3
    return {"status": "queued", "project_id": project_id}


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
    Re-index only the files that changed in a push event.
    Implemented Day 3.
    """
    # TODO Day 3
    return {"status": "queued", "project_id": project_id, "sha": commit_sha}
