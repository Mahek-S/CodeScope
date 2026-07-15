# schemas/organization.py
from pydantic import BaseModel, Field


class OrganizationCreateSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)