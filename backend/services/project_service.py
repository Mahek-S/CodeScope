from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.membership import Membership
from models.project import Project


def get_project_for_user(
    db: Session,
    project_id,
    user_id,
) -> Project:
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    membership = (
        db.query(Membership)
        .filter(
            Membership.org_id == project.org_id,
            Membership.user_id == user_id,
        )
        .first()
    )

    if membership is None:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this project.",
        )

    return project