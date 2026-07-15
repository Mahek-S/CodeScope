import os

from celery import Celery

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
