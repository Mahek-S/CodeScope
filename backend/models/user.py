import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from models.types import EncryptedString

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .organization import Organization
    from .Membership import Membership

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_token: Mapped[str | None] = mapped_column(EncryptedString,nullable=True,)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    memberships: Mapped[list["Membership"]] = relationship(back_populates="user")
    organizations_created: Mapped[list["Organization"]] = relationship(
        back_populates="creator"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} name={self.name!r}>"
