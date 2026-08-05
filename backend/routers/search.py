from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.orm import Session

from database import get_db
from dependencies.auth import get_current_user
from services import search_service
from services.project_service import get_project_for_user
from utils.embeddings import EmbeddingModelUnavailableError

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

    status = search_service.get_index_status(db, project.id)

    # Don't even try to embed the query against a project with nothing
    # (or nothing ready) to search -- returns a clean "still indexing"
    # response instead of a misleading empty result set.
    if status in (search_service.STATUS_NOT_INDEXED, search_service.STATUS_INDEXING):
        return {"query": q, "results": [], "status": status}

    try:
        results = search_service.search_files(
            db=db,
            project_id=project.id,
            query=q,
            limit=limit,
        )
    except EmbeddingModelUnavailableError:
        # The model failed to load in this process. This is a backend
        # problem, not a "your project isn't ready yet" one -- but it
        # should still never surface as a raw 500 to the frontend.
        return {
            "query": q,
            "results": [],
            "status": search_service.STATUS_MODEL_UNAVAILABLE,
        }

    return {"query": q, "results": results, "status": status}