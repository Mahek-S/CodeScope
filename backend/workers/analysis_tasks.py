"""
Celery task that triggers the LangGraph impact analysis workflow.
"""
import logging

from database import SessionLocal
from models.project import Project
from services.analysis_service import trigger_analysis
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="analysis.run_impact_analysis", bind=True, max_retries=2)
def run_impact_analysis(self, project_id: str, pr_number: int, trigger: str = "pr_opened"):
    """
    Load the project and run the full impact analysis workflow for one
    PR. Triggered by the GitHub webhook (PR opened, see
    routers/webhooks.py) or the manual analysis endpoint (see
    routers/analyses.py) — both just enqueue this task with a different
    `trigger` label; the actual work lives in
    services.analysis_service.trigger_analysis.
    """
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            logger.warning("Analysis skipped: project %s not found", project_id)
            return {"status": "skipped", "reason": "project not found", "project_id": project_id}

        analysis = trigger_analysis(db, project, pr_number, trigger=trigger)

        logger.info(
            "Analysis complete for %s PR #%s: risk=%s score=%s",
            project.repo_full_name, pr_number, analysis.risk_level, analysis.risk_score,
        )
        return {
            "status": "completed",
            "analysis_id": str(analysis.id),
            "project_id": project_id,
            "pr_number": pr_number,
            "risk_level": analysis.risk_level,
            "risk_score": float(analysis.risk_score) if analysis.risk_score is not None else None,
        }
    except Exception as e:
        db.rollback()
        logger.error(
            "Impact analysis failed for project %s PR #%s: %s", project_id, pr_number, e
        )
        raise self.retry(exc=e, countdown=30)
    finally:
        db.close()