from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from database import get_db
from dependencies.auth import get_current_user
from models.membership import Membership
from models.organization import Organization
from schemas.organization import OrganizationCreateSchema

router = APIRouter(tags=["organizations"])


@router.post("/orgs")
def create_org(payload: OrganizationCreateSchema, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    org = Organization(name=payload.name, created_by=user.id)
    db.add(org)
    db.flush()  # get org.id before creating membership, same transaction

    db.add(Membership(user_id=user.id, org_id=org.id, role="admin"))  # creator is admin
    db.commit()
    db.refresh(org)
    return org


@router.get("/orgs")
def list_orgs(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return (
        db.query(Organization)
        .join(Membership, Membership.org_id == Organization.id)
        .filter(Membership.user_id == user.id)
        .all()
    )