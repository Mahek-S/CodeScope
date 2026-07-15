import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from config import settings
from database import create_tables
from routers import auth, organizations, projects, webhooks, search, analyses

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CodeScope backend…")
    create_tables()
    logger.info("Database tables created / verified.")
    yield

app = FastAPI(
    title="CodeScope",
    description="Engineering workflow platform — automated PR impact analysis",
    version="0.1.0",
    lifespan=lifespan,
)

# Session middleware
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(organizations.router)
app.include_router(projects.router)
app.include_router(webhooks.router)
app.include_router(search.router)
app.include_router(analyses.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "codescope-backend",
    }

@app.get("/")
async def root():
    return {
        "message": "Welcome to CodeScope",
        "logged_in": True,
    }