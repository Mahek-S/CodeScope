from fastapi import APIRouter

router = APIRouter(tags=["search"])


@router.get("/projects/{project_id}/search")
async def semantic_search(project_id: str, q: str = ""):
    """Semantic search over file embeddings — implemented Day 4."""
    return {"results": [], "query": q}
