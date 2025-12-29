"""
Royalties MVP - FastAPI Application

Music royalties calculation tool for independent labels.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.routers import imports
from app.routers.royalties import router as royalties_router, artists_router as royalties_artists_router
from app.routers.artists import router as artists_router
from app.routers.spotify import router as spotify_router
from app.routers.catalog import router as catalog_router
from app.routers.settings import router as settings_router
from app.routers.match import router as match_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    # Create tables on startup (for development)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Cleanup on shutdown
    await engine.dispose()


app = FastAPI(
    title="Royalties MVP",
    description="Music royalties calculation tool for independent labels",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(imports.router)
app.include_router(royalties_router)
app.include_router(artists_router)
app.include_router(royalties_artists_router)
app.include_router(spotify_router)
app.include_router(catalog_router)
app.include_router(settings_router)
app.include_router(match_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
