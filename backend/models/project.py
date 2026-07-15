import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    github_repo_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    repo_full_name: Mapped[str] = mapped_column(Text, nullable=False)  # e.g. "username/reponame"
    repo_url: Mapped[str] = mapped_column(Text, nullable=False)
    default_branch: Mapped[str] = mapped_column(Text, default="main")
    indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="projects")
    file_nodes: Mapped[list["FileNode"]] = relationship(back_populates="project")
    dependencies: Mapped[list["Dependency"]] = relationship(back_populates="project")
    commits: Mapped[list["Commit"]] = relationship(back_populates="project")
    pull_requests: Mapped[list["PullRequest"]] = relationship(back_populates="project")
    analyses: Mapped[list["Analysis"]] = relationship(back_populates="project")

    def __repr__(self) -> str:
        return f"<Project id={self.id} repo={self.repo_full_name!r}>"