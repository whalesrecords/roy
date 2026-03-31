"""
Royalties MVP - FastAPI Application

Music royalties calculation tool for independent labels.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.routers import imports
from app.routers.analytics import router as analytics_router
from app.routers.artist_portal import router as artist_portal_router
from app.routers.artists import router as artists_router
from app.routers.catalog import router as catalog_router
from app.routers.contracts import router as contracts_router
from app.routers.exports import router as exports_router
from app.routers.finances import router as finances_router
from app.routers.inventory import router as inventory_router
from app.routers.invoice_import import router as invoice_import_router
from app.routers.match import router as match_router
from app.routers.promo import router as promo_router
from app.routers.royalties import artists_router as royalties_artists_router
from app.routers.royalties import router as royalties_router
from app.routers.settings import router as settings_router
from app.routers.spotify import router as spotify_router
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

        # Create sequences
        await conn.execute(text("CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START WITH 1"))

        # Add new enum values
        enum_updates = [
            "ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'detailsdetails'",
        ]
        for sql in enum_updates:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass

        # Add missing columns
        migrations = [
            "ALTER TABLE transactions_normalized ADD COLUMN IF NOT EXISTS item_url VARCHAR(500)",
            "ALTER TABLE advance_ledger ALTER COLUMN artist_id DROP NOT NULL",
            "ALTER TABLE advance_ledger ADD COLUMN IF NOT EXISTS category VARCHAR(50)",
            "ALTER TABLE artists ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'signed'",
            "ALTER TABLE advance_ledger ADD COLUMN IF NOT EXISTS document_url VARCHAR(500)",
            "ALTER TABLE artists ADD COLUMN IF NOT EXISTS access_code VARCHAR(20)",
            "ALTER TABLE artists ADD COLUMN IF NOT EXISTS email VARCHAR(255)",
            "ALTER TABLE advance_ledger ADD COLUMN IF NOT EXISTS promo_submission_id UUID",
            # Fix Bandcamp transactions: when period_end != period_start, set period_end = period_start
            # (each Bandcamp sale is a single date, period_end was wrongly set to the import's period_end)
            """UPDATE transactions_normalized SET period_end = period_start
               WHERE store_name = 'Bandcamp' AND period_end != period_start""",
            # Add intermediary support to contract parties
            "ALTER TABLE contract_parties ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255)",
            "ALTER TABLE contract_parties ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50)",
            # Expand party_type enum to support intermediaries
            """DO $$ BEGIN
                ALTER TYPE partytype ADD VALUE IF NOT EXISTS 'manager';
                ALTER TYPE partytype ADD VALUE IF NOT EXISTS 'booker';
                ALTER TYPE partytype ADD VALUE IF NOT EXISTS 'agent';
                ALTER TYPE partytype ADD VALUE IF NOT EXISTS 'publisher';
                ALTER TYPE partytype ADD VALUE IF NOT EXISTS 'other';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$""",
            # Drop old constraint and add new one that allows intermediaries
            "ALTER TABLE contract_parties DROP CONSTRAINT IF EXISTS check_party_type_consistency",
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
            "CREATE INDEX IF NOT EXISTS idx_advance_ledger_promo_submission ON advance_ledger(promo_submission_id) WHERE promo_submission_id IS NOT NULL",
            # Additional indexes for contracts and royalty queries
            "CREATE INDEX IF NOT EXISTS idx_contracts_artist_scope ON contracts(artist_id, scope, scope_id)",
            "CREATE INDEX IF NOT EXISTS idx_contracts_artist_start ON contracts(artist_id, start_date)",
            "CREATE INDEX IF NOT EXISTS idx_royalty_runs_status ON royalty_runs(status)",
            "CREATE INDEX IF NOT EXISTS idx_statements_run_id ON statements(royalty_run_id)",
            "CREATE INDEX IF NOT EXISTS idx_royalty_items_artist_run ON royalty_line_items(artist_id, royalty_run_id)",
            "CREATE INDEX IF NOT EXISTS idx_tx_artist_id ON transactions_normalized(artist_id) WHERE artist_id IS NOT NULL",
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

# CORS middleware — restrict to known frontend origins
ALLOWED_ORIGINS = [
    "https://admin.whalesrecords.com",
    "https://artist.whalesrecords.com",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Admin-Token"],
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
app.include_router(promo_router)
app.include_router(exports_router)
app.include_router(inventory_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "2026-01-28-v4-promo-column",
        "git_commit": "pending"
    }
