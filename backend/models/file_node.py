import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import ARRAY, DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

EMBEDDING_DIM = 384  # sentence-transformers all-MiniLM-L6-v2 output dimension


class FileNode(Base):
    __tablename__ = "file_nodes"
    __table_args__ = (UniqueConstraint("project_id", "filepath"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    filepath: Mapped[str] = mapped_column(Text, nullable=False)  # relative path
    language: Mapped[str] = mapped_column(Text, default="python")
    classes: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    functions: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    exports: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(EMBEDDING_DIM), nullable=True
    )
    last_indexed: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="file_nodes")
    symbol_embeddings: Mapped[list["FileSymbolEmbedding"]] = relationship(
        back_populates="file_node"
    )
    outgoing_deps: Mapped[list["Dependency"]] = relationship(
        foreign_keys="Dependency.source_file_id",
        back_populates="source_file",
    )
    incoming_deps: Mapped[list["Dependency"]] = relationship(
        foreign_keys="Dependency.target_file_id",
        back_populates="target_file",
    )

    def __repr__(self) -> str:
        return f"<FileNode id={self.id} filepath={self.filepath!r}>"


class FileSymbolEmbedding(Base):
    """Stretch goal: per-class/function embeddings for finer semantic search."""

    __tablename__ = "file_symbol_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    file_node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("file_nodes.id"), nullable=False
    )
    symbol_name: Mapped[str] = mapped_column(Text, nullable=False)
    symbol_type: Mapped[str] = mapped_column(Text, nullable=False)  # 'class' | 'function'
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(EMBEDDING_DIM), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    file_node: Mapped["FileNode"] = relationship(back_populates="symbol_embeddings")

    def __repr__(self) -> str:
        return f"<FileSymbolEmbedding symbol={self.symbol_name!r} type={self.symbol_type!r}>"
