from fastapi import Request, HTTPException
from sqlalchemy.orm import Session
from models.user import User


def get_current_user(request: Request, db: Session) -> User:
    """Load the logged-in user from the session, or 401."""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(401, "Not authenticated")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(401, "Not authenticated")

    return user