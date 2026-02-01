from celery import Celery
import os


broker_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
backend_url = broker_url

celery_app = Celery(
    "doc_analysis",
    broker=broker_url,
    backend=backend_url,
    include=[
        "app.workers.tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)


