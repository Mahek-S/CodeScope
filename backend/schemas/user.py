import uuid

from pydantic import BaseModel


class CurrentUserSchema(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None
    avatar_url: str | None
    github_username: str | None

    class Config:
        from_attributes = True