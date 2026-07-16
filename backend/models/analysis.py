import uuid
from datetime import datetime

from sqlalchemy import ARRAY, BigInteger, DateTime, ForeignKey, Integer, Numeric, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .project import Project


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    pr_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trigger: Mapped[str | None] = mapped_column(Text, nullable=True)  # 'pr_opened' | 'manual'

    # Input
    changed_files: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)

    # Output — deterministic
    directly_affected: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    transitively_affected: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    similar_past_bugs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    suggested_tests: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)

    # Risk — deterministic score, then LLM-explained
    risk_score: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    risk_level: Mapped[str | None] = mapped_column(Text, nullable=True)  # 'low' | 'medium' | 'high'

    # Output — LLM
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_llm_output: Mapped[str | None] = mapped_column(Text, nullable=True)

    # GitHub
    github_comment_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="analyses")

    def __repr__(self) -> str:
        return f"<Analysis id={self.id} risk={self.risk_level!r}>"
