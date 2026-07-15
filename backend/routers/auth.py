from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from database import get_db
from services.github_service import GitHubService
from models.user import User
from config import settings


router = APIRouter(prefix="/auth/github", tags=["auth"])
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"


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
    else:
        user = User(
            github_id=gh_user["id"],
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