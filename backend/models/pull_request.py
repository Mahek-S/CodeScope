import uuid
from datetime import datetime

from sqlalchemy import ARRAY, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .project import Project

class PullRequest(Base):
    __tablename__ = "pull_requests"
    __table_args__ = (UniqueConstraint("project_id", "pr_number"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    pr_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    author: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_files: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    base_branch: Mapped[str | None] = mapped_column(Text, nullable=True)
    head_branch: Mapped[str | None] = mapped_column(Text, nullable=True)
    opened_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="pull_requests")

    def __repr__(self) -> str:
        return f"<PullRequest #{self.pr_number}>"
