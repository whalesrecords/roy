"""
Royalties MVP - FastAPI Application

Music royalties calculation tool for independent labels.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine, async_session_maker

logger = logging.getLogger(__name__)

# Import models so SQLAlchemy registers them with Base.metadata
import app.models.manual_release  # noqa: F401
import app.models.manual_track  # noqa: F401
import app.models.push_token  # noqa: F401
import app.models.artist_push_token  # noqa: F401
import app.models.contract_signature  # noqa: F401
import app.models.contract_track_contributor  # noqa: F401
import app.models.label  # noqa: F401
import app.models.label_member  # noqa: F401
import app.models.artist_label  # noqa: F401
import app.models.label_distributor  # noqa: F401
from app.routers import imports
from app.routers.push import router as push_router
from app.routers.analytics import router as analytics_router
from app.routers.artist_portal import router as artist_portal_router
from app.routers.artists import router as artists_router
from app.routers.catalog import router as catalog_router
from app.routers.contracts import router as contracts_router
from app.routers.exports import router as exports_router
from app.routers.assets import router as assets_router
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
from app.routers.labels import router as labels_router


# Tenant-scoped data tables — each carries a ``label_id`` for isolation.
# (Excludes artist-level shared tables: artists, artist_profiles, artist_tokens,
#  artist_push_tokens, track_artist_links — an artist may belong to several
#  labels; and the multi-tenant infra tables themselves.)
TENANT_TABLES = [
    "contracts", "contract_parties", "contract_signatures", "contract_track_contributors",
    "statements", "royalty_runs", "royalty_line_items", "advance_ledger",
    "transactions_normalized", "products", "stock_movements", "fixed_assets",
    "imports", "promo_campaigns", "promo_submissions", "spotify_ad_campaigns",
    "spotify_track_suggestions", "match_suggestions", "notifications", "artist_notifications",
    "manual_releases", "manual_tracks", "tickets", "ticket_messages", "ticket_participants",
    "label_settings", "release_artwork", "track_artwork",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    # Create tables on startup (for development)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create performance indexes and missing columns if they don't exist
    async with engine.begin() as conn:
        from sqlalchemy import text

        # Create sequences (PostgreSQL only)
        try:
            await conn.execute(text("CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START WITH 1"))
        except Exception:
            pass  # SQLite doesn't support sequences

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
            # Dark mode logo support
            "ALTER TABLE label_settings ADD COLUMN IF NOT EXISTS logo_dark_base64 TEXT",
        ]
        for sql in migrations:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass  # Column might already exist

        # Multi-tenant Phase A — add nullable label_id to every tenant table
        # (+ index). Additive & non-breaking: no query filters on it yet.
        for tbl in TENANT_TABLES:
            for sql in (
                f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS label_id UUID",
                f"CREATE INDEX IF NOT EXISTS idx_{tbl}_label_id ON {tbl}(label_id)",
            ):
                try:
                    await conn.execute(text(sql))
                except Exception:
                    pass  # table/column may not exist yet

        # Multi-tenant — Postgres RLS isolation (defense in depth) on ALL tenant
        # tables. The policy is permissive UNLESS a request sets
        # app.current_label_id (done by the label-context dependency), so the
        # platform/global, background and artist paths are never blocked. The
        # column DEFAULT auto-stamps inserts with the current label. The ALTER/
        # policy statements are metadata-only — instant even on huge tables.
        for tbl in TENANT_TABLES:
            cond = (
                "nullif(current_setting('app.current_label_id', true), '') IS NULL "
                "OR label_id = nullif(current_setting('app.current_label_id', true), '')::uuid"
            )
            for sql in (
                f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY",
                f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY",
                f"DROP POLICY IF EXISTS tenant_isolation ON {tbl}",
                f"CREATE POLICY tenant_isolation ON {tbl} USING ({cond}) WITH CHECK ({cond})",
                f"ALTER TABLE {tbl} ALTER COLUMN label_id "
                "SET DEFAULT nullif(current_setting('app.current_label_id', true), '')::uuid",
            ):
                try:
                    await conn.execute(text(sql))
                except Exception:
                    pass

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
            try:
                await conn.execute(text(idx_sql))
            except Exception:
                pass  # Column or table may not exist yet

    # Seed multi-tenant foundation: Whales Records label #1 + backfill.
    # Idempotent — only runs the first time, when no label exists yet.
    try:
        from sqlalchemy import select
        from app.core.config import settings as _settings
        from app.models.label import Label, LabelStatus
        from app.models.label_member import LabelMember, LabelRole
        from app.models.artist_label import ArtistLabel
        from app.models.artist import Artist

        async with async_session_maker() as session:
            existing_label = (await session.execute(select(Label).limit(1))).scalar_one_or_none()
            if existing_label is None:
                whales = Label(
                    slug="whales-records",
                    name="Whales Records",
                    status=LabelStatus.ACTIVE.value,
                    plan="pro",
                    accent_color="#EF7E2E",
                )
                session.add(whales)
                await session.flush()  # populate whales.id

                # Existing admins become owners + platform admins of Whales.
                for email in sorted(_settings.admin_emails):
                    session.add(LabelMember(
                        label_id=whales.id,
                        email=email,
                        role=LabelRole.OWNER.value,
                        is_platform_admin=True,
                    ))

                # Link every existing artist to Whales (many-to-many).
                artist_ids = (await session.execute(select(Artist.id))).scalars().all()
                for aid in artist_ids:
                    session.add(ArtistLabel(label_id=whales.id, artist_id=aid))

                await session.commit()
                logger.info(
                    "Seeded Whales label (%s members, %s artist links)",
                    len(_settings.admin_emails), len(artist_ids),
                )
    except Exception as exc:  # pragma: no cover - defensive, never block startup
        logger.error("Label foundation seed skipped: %s", exc, exc_info=True)

    # Multi-tenant label_id backfill runs as a BACKGROUND task (below), not
    # inline: some tenant tables have >1M rows, and a single startup transaction
    # would block serving and roll everything back on restart.

    # Start background tasks
    scanner_task = asyncio.create_task(_weekly_spotify_scanner())
    backfill_task = asyncio.create_task(_backfill_label_ids())
    alerts_task = asyncio.create_task(_admin_alerts_scanner())

    yield

    # Cleanup on shutdown
    for task in (scanner_task, backfill_task, alerts_task):
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    await engine.dispose()


async def _backfill_label_ids():
    """Assign label_id = Whales to existing NULL tenant rows, in the background.

    Runs per-table, in small batches, each batch its own transaction — so it
    never blocks startup and never rolls everything back (some tables have
    >1M rows). Idempotent: once a table is filled, its batches return 0 rows.
    """
    from sqlalchemy import select, text
    from app.models.label import Label

    BATCH = 50_000
    await asyncio.sleep(15)  # let the app finish booting before churning the DB
    try:
        async with async_session_maker() as session:
            whales_id = (
                await session.execute(select(Label.id).where(Label.slug == "whales-records"))
            ).scalar()
        if whales_id is None:
            return

        for tbl in TENANT_TABLES:
            filled = 0
            while True:
                try:
                    async with engine.begin() as conn:
                        res = await conn.execute(text(
                            f"UPDATE {tbl} SET label_id = "
                            "(SELECT id FROM labels WHERE slug = 'whales-records') "
                            f"WHERE ctid IN (SELECT ctid FROM {tbl} WHERE label_id IS NULL LIMIT {BATCH})"
                        ))
                        n = res.rowcount or 0
                except Exception as exc:
                    logger.error("label_id backfill on %s failed: %s", tbl, exc)
                    break
                filled += n
                if n < BATCH:
                    break
                await asyncio.sleep(0.5)  # be gentle on the DB
            if filled:
                logger.info("Backfilled label_id (Whales) on %s rows of %s", filled, tbl)
        logger.info("label_id background backfill complete")
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("label_id background backfill error: %s", exc, exc_info=True)


async def _weekly_spotify_scanner():
    """
    Background task that runs the Spotify new-release scanner once a week.

    On first run it waits 5 minutes (to let the app fully start), then
    repeats every 7 days.
    """
    INTERVAL_SECONDS = 7 * 24 * 3600  # 1 week
    STARTUP_DELAY = 5 * 60            # 5 minutes after boot

    await asyncio.sleep(STARTUP_DELAY)

    while True:
        try:
            from app.services.spotify_scanner import refresh_artist_photos, scan_new_releases
            async with async_session_maker() as db:
                logger.info("Weekly Spotify scanner: refreshing artist photos…")
                photo_summary = await refresh_artist_photos(db)
                logger.info(f"Weekly Spotify scanner photos: {photo_summary}")
                logger.info("Weekly Spotify scanner: scanning new releases…")
                summary = await scan_new_releases(db)
                logger.info(f"Weekly Spotify scanner releases: {summary}")
        except Exception as exc:
            logger.error(f"Weekly Spotify scanner error: {exc}", exc_info=True)

        await asyncio.sleep(INTERVAL_SECONDS)


async def _admin_alerts_scanner():
    """
    Background task that scans for label-facing conditions needing attention
    (late sales imports, unpaid statements, high unrecouped advances, high spend)
    once a day and writes admin notifications + push.

    Waits ~8 minutes after boot, then repeats every 24h. See
    app/services/admin_alerts.py for the rules and thresholds.
    """
    INTERVAL_SECONDS = 24 * 3600  # daily
    STARTUP_DELAY = 8 * 60        # 8 minutes after boot

    await asyncio.sleep(STARTUP_DELAY)

    while True:
        try:
            from app.services.admin_alerts import scan_admin_alerts
            async with async_session_maker() as db:
                await scan_admin_alerts(db)
        except Exception as exc:
            logger.error(f"Admin alerts scanner error: {exc}", exc_info=True)

        await asyncio.sleep(INTERVAL_SECONDS)


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
app.include_router(labels_router)
app.include_router(promo_router)
app.include_router(exports_router)
app.include_router(inventory_router)
app.include_router(assets_router)
app.include_router(push_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "2026-01-28-v4-promo-column",
        "git_commit": "pending"
    }
