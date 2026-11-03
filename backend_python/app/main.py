"""FastAPI application factory and entry point.

Creates the FastAPI application instance, registers CORS middleware,
exception handlers, lifespan events, and the /api/health route.

Lifespan now connects to MongoDB on startup and closes on shutdown.
"""

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.connection import close_db, connect_db
from app.db.init import init_db
from app.handlers import register_exception_handlers
from app.logging import configure_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler.

    Startup: connect to MongoDB and verify indexes.
    Shutdown: close MongoDB connection.
    """
    await connect_db()
    await init_db()
    try:
        yield
    finally:
        await close_db()


def create_app() -> FastAPI:
    """Application factory: build and configure the FastAPI instance."""
    configure_logging()

    app = FastAPI(
        title="CarFit AI Backend (Python/FastAPI)",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            settings.client_url,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    @app.get("/api/health")
    async def health() -> dict[str, bool]:
        """Health check endpoint. Returns exactly {"ok": true}."""
        return {"ok": True}

    return app


app = create_app()
