# schemas/project.py
from pydantic import BaseModel, Field, ConfigDict
import uuid

class ProjectCreateSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    repo_full_name: str = Field(
        ..., pattern=r"^[\w.-]+/[\w.-]+$", description="e.g. 'octocat/hello-world'"
    )
    repo_url: str
    default_branch: str | None = None

class ProjectSummarySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    repo_full_name: str