from datetime import datetime

from sqlalchemy import DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class WebhookDelivery(Base):
    """
    Records every GitHub webhook delivery ID we've processed.

    GitHub retries deliveries that time out or fail with a 5xx, reusing
    the same X-GitHub-Delivery ID for the retry. Inserting the ID here
    with ON CONFLICT DO NOTHING before doing any work turns "have we
    already processed this exact delivery" into a single indexed
    upsert, and covers every event type (push, pull_request, ...)
    rather than a narrower "already have an analysis for this PR"
    check, which wouldn't catch duplicate push deliveries and could
    also mask a legitimate distinct event that happens to share a PR
    number.
    """

    __tablename__ = "webhook_deliveries"

    delivery_id: Mapped[str] = mapped_column(Text, primary_key=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<WebhookDelivery {self.delivery_id}>"