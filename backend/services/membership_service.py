from sqlalchemy.orm import Session
from fastapi import HTTPException
from models.membership import Membership

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