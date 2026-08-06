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

    # Load the embedding model once, now, instead of lazily on whichever
    # search request happens to hit this process first. Mirrors the
    # Celery-side preload in workers/celery_app.py::preload_embedding_model
    # -- same reasoning: a predictable one-time startup cost beats a
    # surprise cost (and possible failure) inside a request handler.
    # Non-fatal if it fails: search/analysis endpoints degrade to an
    # "indexing"/unavailable response rather than crashing, and this
    # avoids the API being unable to start at all just because the model
    # can't load (e.g. no network on first-ever run, disk full, ...).
    from utils.embeddings import warm_up

    try:
        warm_up()
    except Exception as e:
        logger.error("Embedding model preload failed at API startup: %s", e)

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
    allow_origins=[settings.frontend_url],
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
app.include_router(auth.me_router)


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