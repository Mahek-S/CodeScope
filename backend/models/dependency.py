import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Dependency(Base):
    """
    Directed edge: source_file imports target_file.
    Used to build the file-level dependency graph.
    """

    __tablename__ = "dependencies"
    __table_args__ = (UniqueConstraint("source_file_id", "target_file_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    source_file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("file_nodes.id"), nullable=False
    )
    target_file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("file_nodes.id"), nullable=False
    )

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="dependencies")
    source_file: Mapped["FileNode"] = relationship(
        foreign_keys=[source_file_id], back_populates="outgoing_deps"
    )
    target_file: Mapped["FileNode"] = relationship(
        foreign_keys=[target_file_id], back_populates="incoming_deps"
    )

    def __repr__(self) -> str:
        return f"<Dependency {self.source_file_id} → {self.target_file_id}>"
