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
    """
    from utils.embeddings import _get_model
    _get_model()
