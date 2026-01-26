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
from app.routers.analytics import router as analytics_router
from app.routers.finances import router as finances_router
from app.routers.contracts import router as contracts_router
from app.routers.invoice_import import router as invoice_import_router
from app.routers.artist_portal import router as artist_portal_router
from app.routers.tickets import router as tickets_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    # Create tables on startup (for development)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create performance indexes and missing columns if they don't exist
    async with engine.begin() as conn:
        from sqlalchemy import text

        # Add missing columns
        migrations = [
            "ALTER TABLE transactions_normalized ADD COLUMN IF NOT EXISTS item_url VARCHAR(500)",
            "ALTER TABLE advance_ledger ALTER COLUMN artist_id DROP NOT NULL",
            "ALTER TABLE advance_ledger ADD COLUMN IF NOT EXISTS category VARCHAR(50)",
            "ALTER TABLE artists ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'signed'",
            "ALTER TABLE advance_ledger ADD COLUMN IF NOT EXISTS document_url VARCHAR(500)",
            "ALTER TABLE artists ADD COLUMN IF NOT EXISTS access_code VARCHAR(20)",
            "ALTER TABLE artists ADD COLUMN IF NOT EXISTS email VARCHAR(255)",
        ]
        for sql in migrations:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass  # Column might already exist

        # Create indexes
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_tx_artist_name ON transactions_normalized(artist_name)",
            "CREATE INDEX IF NOT EXISTS idx_tx_period ON transactions_normalized(period_start, period_end)",
            "CREATE INDEX IF NOT EXISTS idx_tx_isrc ON transactions_normalized(isrc) WHERE isrc IS NOT NULL",
            "CREATE INDEX IF NOT EXISTS idx_tx_upc ON transactions_normalized(upc) WHERE upc IS NOT NULL",
            "CREATE INDEX IF NOT EXISTS idx_tx_artist_period ON transactions_normalized(artist_name, period_start, period_end)",
            "CREATE INDEX IF NOT EXISTS idx_tx_import_id ON transactions_normalized(import_id)",
        ]
        for idx_sql in indexes:
            await conn.execute(text(idx_sql))

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
app.include_router(analytics_router)
app.include_router(finances_router)
app.include_router(contracts_router)
app.include_router(invoice_import_router)
app.include_router(artist_portal_router)
app.include_router(tickets_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
