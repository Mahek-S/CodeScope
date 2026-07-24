from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from database import get_db
from services.github_service import GitHubService
from dependencies.auth import get_current_user
from models.user import User
from schemas.user import CurrentUserSchema
from config import settings


router = APIRouter(prefix="/auth/github", tags=["auth"])
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"

# Separate router: these live at /auth/*, not /auth/github/*
me_router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("")
def login():
    params = f"client_id={settings.github_client_id}&scope=repo,user:email"
    return RedirectResponse(f"{GITHUB_AUTHORIZE_URL}?{params}")


@router.get("/callback")
async def callback(request: Request, code: str, db: Session = Depends(get_db)):
    if not code:
        raise HTTPException(400, "Missing OAuth code")

    access_token = await GitHubService.exchange_code_for_token(code)
    gh_user = await GitHubService.fetch_github_user(access_token)

    user = db.query(User).filter(User.github_id == gh_user["id"]).first()
    if user:
        user.access_token = access_token
        user.name = gh_user.get("name") or gh_user["login"]
        user.avatar_url = gh_user.get("avatar_url")
        user.github_username = gh_user["login"]
    else:
        user = User(
            github_id=gh_user["id"],
            github_username=gh_user["login"],
            email=gh_user.get("email"),
            name=gh_user.get("name") or gh_user["login"],
            avatar_url=gh_user.get("avatar_url"),
            access_token=access_token,
        )
        db.add(user)
    db.commit()
    db.refresh(user)

    request.session["user_id"] = str(user.id)
    return RedirectResponse(url="/")


@me_router.get("/me", response_model=CurrentUserSchema)
def get_me(request: Request, db: Session = Depends(get_db)):
    """
    Returns the currently authenticated user, or 401 if there's no
    valid session. The frontend calls this once on app load to decide
    between rendering the app or the login page — this is what makes
    the session "just work" on repeat visits without hitting GitHub again.
    """
    user = get_current_user(request, db)
    return user


@me_router.post("/logout")
def logout(request: Request):
    """Clears the session. Frontend should redirect to /login after this."""
    request.session.clear()
    return {"detail": "Logged out"}