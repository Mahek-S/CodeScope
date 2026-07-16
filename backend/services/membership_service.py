from sqlalchemy.orm import Session
from fastapi import HTTPException
from models.membership import Membership
from models.project import Project

def require_membership(db: Session, user_id: str, org_id: str) -> Membership:
    """Raise 403 if the user isn't a member of the org. Return the membership row."""
    membership = db.query(Membership).filter(
        Membership.user_id == user_id, Membership.org_id == org_id
    ).first()
    if not membership:
        raise HTTPException(403, "Not a member of this organization")
    return membership


def require_admin(db: Session, user_id: str, org_id: str) -> Membership:
    """Raise 403 unless the user is an admin of the org."""
    membership = require_membership(db, user_id, org_id)
    if membership.role != "admin":
        raise HTTPException(403, "Admin role required")
    return membership


def require_project_admin(
    db,
    user_id,
    project_id,
):
    """
    Ensure the current user is an ADMIN of the
    organization that owns this project.
    """

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
            detail="Not a member of this organization.",
        )

    if membership.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )

    return project