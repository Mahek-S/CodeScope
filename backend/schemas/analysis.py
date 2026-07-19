# schemas/analysis.py
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AnalysisTriggerSchema(BaseModel):
    """Body for POST /projects/{project_id}/analyses (manual trigger)."""

    pr_number: int = Field(..., gt=0)


class AnalysisSummarySchema(BaseModel):
    """Lightweight shape used in list views."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pr_number: int | None
    trigger: str | None
    risk_level: str | None
    risk_score: float | None
    created_at: datetime


class AnalysisDetailSchema(AnalysisSummarySchema):
    """Full shape used in single-analysis detail views."""

    changed_files: list[str] | None
    directly_affected: list[str] | None
    transitively_affected: list[str] | None
    similar_past_bugs: dict | None
    suggested_tests: list[str] | None
    explanation: str | None
    github_comment_id: int | None