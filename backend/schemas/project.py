# schemas/project.py
from pydantic import BaseModel, Field


class ProjectCreateSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    repo_full_name: str = Field(
        ..., pattern=r"^[\w.-]+/[\w.-]+$", description="e.g. 'octocat/hello-world'"
    )
    repo_url: str
    default_branch: str | None = None