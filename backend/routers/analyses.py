from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database import get_db
from dependencies.auth import get_current_user
from models.analysis import Analysis
from schemas.analysis import (
    AnalysisDetailSchema,
    AnalysisSummarySchema,
    AnalysisTriggerSchema,
)
from services.project_service import get_project_for_user
from workers.analysis_tasks import run_impact_analysis

router = APIRouter(tags=["analyses"])


@router.get(
    "/projects/{project_id}/analyses",
    response_model=list[AnalysisSummarySchema],
)
def list_analyses(
    project_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_current_user(request, db)
    project = get_project_for_user(db=db, project_id=project_id, user_id=user.id)

    return (
        db.query(Analysis)
        .filter(Analysis.project_id == project.id)
        .order_by(Analysis.created_at.desc())
        .all()
    )


@router.post("/projects/{project_id}/analyses", status_code=202)
def trigger_analysis(
    project_id: str,
    payload: AnalysisTriggerSchema,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Manually trigger an impact analysis for an already-open PR. Runs the
    same LangGraph workflow the webhook uses on "PR opened" — just
    queued with trigger='manual' instead of 'pr_opened' so it's clear in
    the analysis history which ones ran automatically.
    """
    user = get_current_user(request, db)
    project = get_project_for_user(db=db, project_id=project_id, user_id=user.id)

    task = run_impact_analysis.delay(str(project.id), payload.pr_number, "manual")

    return {"detail": "Analysis started", "task_id": task.id}


@router.get("/analyses/{analysis_id}", response_model=AnalysisDetailSchema)
def get_analysis(
    analysis_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_current_user(request, db)

    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Reuses the project-membership check rather than duplicating it —
    # an analysis is only visible to someone who can see its project.
    get_project_for_user(db=db, project_id=str(analysis.project_id), user_id=user.id)

    return analysis