from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.orm import Session

from database import get_db
from dependencies.auth import get_current_user
from services import search_service
from services.project_service import get_project_for_user

router = APIRouter(tags=["search"])


@router.get("/projects/{project_id}/search")
def semantic_search(
    project_id: str,
    request: Request,
    q: str = Query(..., min_length=1, description="Natural language search query"),
    limit: int = Query(search_service.DEFAULT_LIMIT, ge=1, le=search_service.MAX_LIMIT),
    db: Session = Depends(get_db),
):
    user = get_current_user(request, db)

    project = get_project_for_user(
        db=db,
        project_id=project_id,
        user_id=user.id,
    )

    results = search_service.search_files(
        db=db,
        project_id=project.id,
        query=q,
        limit=limit,
    )

    return {"query": q, "results": results}