from fastapi import APIRouter

router = APIRouter(tags=["analyses"])


@router.get("/projects/{project_id}/analyses")
async def list_analyses(project_id: str):
    """List analyses for a project — implemented Day 5."""
    return {"analyses": []}


@router.post("/projects/{project_id}/analyses")
async def trigger_analysis(project_id: str):
    """Trigger manual analysis — implemented Day 5."""
    return {"detail": "Manual analysis — coming Day 5"}


@router.get("/analyses/{analysis_id}")
async def get_analysis(analysis_id: str):
    """Get analysis detail — implemented Day 5."""
    return {"detail": "Analysis detail — coming Day 5"}
