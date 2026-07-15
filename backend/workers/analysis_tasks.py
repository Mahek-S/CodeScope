"""
Celery tasks for triggering the LangGraph impact analysis workflow.
Implemented fully on Day 5.
"""

from workers.celery_app import celery_app


@celery_app.task(name="analysis.run_impact_analysis", bind=True, max_retries=2)
def run_impact_analysis(self, project_id: str, pr_number: int, changed_files: list):
    """
    Trigger the full LangGraph impact analysis workflow for a PR.
    Implemented Day 5.
    """
    # TODO Day 5
    return {
        "status": "queued",
        "project_id": project_id,
        "pr_number": pr_number,
    }
