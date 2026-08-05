import os

from celery import Celery
from celery.signals import worker_process_init

# Read REDIS_URL from environment (set via .env / Docker Compose)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "codescope",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "workers.indexing_tasks",
        "workers.analysis_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Retry settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Rate limiting / concurrency handled at worker startup
)

@worker_process_init.connect
def preload_embedding_model(**kwargs):
    """
    Force the sentence-transformers model to load once, right when this
    worker process forks, instead of lazily on whichever task happens to
    call generate_embedding/generate_embeddings_batch first. Makes the
    ~20-50s model-load cost a predictable one-time startup expense per
    worker process rather than something that randomly shows up mid-task.

    Every prefork child hits this independently -- that's expected (each
    OS process needs its own copy in memory), not a bug. If it fails here,
    don't crash the worker process: log it and let the model's own
    EmbeddingModelUnavailableError surface cleanly from the first task
    that actually needs it, where it's caught and retried like any other
    task failure (see workers/indexing_tasks.generate_embeddings).
    """
    from utils.embeddings import warm_up

    try:
        warm_up()
    except Exception as e:  # noqa: BLE001
        import logging

        logging.getLogger(__name__).error(
            "Embedding model preload failed at worker startup: %s", e
        )