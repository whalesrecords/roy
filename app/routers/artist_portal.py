"""Artist Portal API endpoints for artists to view their royalties."""
import logging
import secrets
import uuid
import json
from datetime import datetime
from typing import Optional, List

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.config import settings
from app.models.artist import Artist
from app.models.transaction import TransactionNormalized
from app.models.advance_ledger import AdvanceLedgerEntry, LedgerEntryType, ExpenseCategory
from app.models.contract import Contract
from app.models.artwork import ReleaseArtwork, TrackArtwork
from app.models.contract_party import ContractParty
from app.models.label_settings import LabelSettings
from app.models.statement import Statement
from app.models.royalty_line_item import RoyaltyLineItem
from app.models.artist_profile import ArtistProfile
from app.models.notification import Notification, NotificationType
from app.models.artist_notification import ArtistNotification, ArtistNotificationType
from app.models.ticket import Ticket, TicketStatus, TicketCategory, TicketPriority
from app.models.ticket_message import TicketMessage, MessageSender
from app.models.ticket_participant import TicketParticipant
from app.models.promo_submission import PromoSubmission, PromoSource
from app.models.promo_campaign import PromoCampaign

router = APIRouter(prefix="/artist-portal", tags=["Artist Portal"])


# ============ Schemas ============

class LoginRequest(BaseModel):
    """Login with access code (legacy)."""
    code: str


class EmailLoginRequest(BaseModel):
    """Login with email and password."""
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    artist: dict


class CreateArtistAuthRequest(BaseModel):
    """Request to create Supabase auth account for an artist."""
    artist_id: str
    email: str
    password: str


class ArtistInfo(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    artwork_url: Optional[str] = None


class DashboardResponse(BaseModel):
    artist: dict
    total_gross: str
    total_net: str
    total_streams: int
    advance_balance: str
    currency: str
    release_count: int
    track_count: int


class ReleaseResponse(BaseModel):
    upc: str
    title: str
    artwork_url: Optional[str] = None
    gross: str
    net: str
    streams: int
    track_count: int
    currency: str


class TrackResponse(BaseModel):
    isrc: str
    title: str
    release_title: Optional[str] = None
    artwork_url: Optional[str] = None
    gross: str
    net: str
    streams: int
    currency: str


class PaymentResponse(BaseModel):
    id: str
    amount: str
    currency: str
    date: str
    description: Optional[str] = None


class PlatformStatsResponse(BaseModel):
    platform: str
    platform_label: str
    gross: str
    streams: int
    percentage: float


class ExpenseResponse(BaseModel):
    id: str
    amount: str
    currency: str
    category: Optional[str] = None
    category_label: Optional[str] = None
    scope: str
    scope_title: Optional[str] = None
    description: Optional[str] = None
    date: str


class ContractResponse(BaseModel):
    id: str
    scope: str
    scope_id: Optional[str] = None
    scope_title: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    artist_share: float
    label_share: float
    description: Optional[str] = None


class QuarterlyRevenueResponse(BaseModel):
    quarter: str
    year: int
    gross: str
    net: str
    streams: int
    currency: str


class LabelSettingsResponse(BaseModel):
    label_name: Optional[str] = None
    logo_url: Optional[str] = None
    logo_base64: Optional[str] = None


class StatementResponse(BaseModel):
    id: str
    period_start: str
    period_end: str
    period_label: str
    gross_revenue: str
    artist_royalties: str
    recouped: str
    net_payable: str
    currency: str
    status: str
    created_at: str


class StatementReleaseDetail(BaseModel):
    upc: str
    title: str
    gross: str
    artist_royalties: str
    track_count: int


class StatementSourceDetail(BaseModel):
    source: str
    source_label: str
    gross: str
    artist_royalties: str
    transaction_count: int


class StatementDetailResponse(BaseModel):
    id: str
    period_start: str
    period_end: str
    period_label: str
    gross_revenue: str
    artist_royalties: str
    recouped: str
    net_payable: str
    advance_balance: str
    currency: str
    status: str
    created_at: str
    releases: List[StatementReleaseDetail]
    sources: List[StatementSourceDetail]


# ============ Token Storage (simple in-memory for MVP) ============
# In production, use Redis or database storage
# Note: Access code tokens are still stored here for backward compatibility

_tokens: dict[str, str] = {}  # token -> artist_id


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def store_token(token: str, artist_id: str):
    _tokens[token] = artist_id


def get_artist_id_from_token(token: str) -> Optional[str]:
    return _tokens.get(token)


def get_supabase_client():
    """Get Supabase client lazily to avoid import errors if not configured."""
    from app.core.supabase_client import get_supabase_admin_client
    return get_supabase_admin_client()


async def get_current_artist(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
) -> Artist:
    """Get the current artist from the authorization header.

    Supports two token types:
    1. Legacy in-memory tokens (from access code login)
    2. Supabase JWT tokens (from email/password login)
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non authentifié")

    token = authorization.replace("Bearer ", "")

    # First try legacy token lookup
    artist_id = get_artist_id_from_token(token)

    if artist_id:
        # Legacy token found
        result = await db.execute(select(Artist).where(Artist.id == uuid.UUID(artist_id)))
        artist = result.scalar_one_or_none()
        if artist:
            return artist

    # Try Supabase JWT validation
    if settings.SUPABASE_SERVICE_ROLE_KEY:
        try:
            supabase = get_supabase_client()
            # Verify the JWT token and get user info
            user_response = supabase.auth.get_user(token)
            if user_response and user_response.user:
                auth_user_id = user_response.user.id
                # Find artist by auth_user_id
                result = await db.execute(
                    select(Artist).where(Artist.auth_user_id == auth_user_id)
                )
                artist = result.scalar_one_or_none()
                if artist:
                    return artist
        except Exception as e:
            logger.debug(f"Supabase token validation failed: {e}")

    raise HTTPException(status_code=401, detail="Token invalide ou expiré")


# ============ Endpoints ============

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with access code (legacy)."""
    result = await db.execute(
        select(Artist).where(Artist.access_code == request.code.upper())
    )
    artist = result.scalar_one_or_none()

    if not artist:
        raise HTTPException(status_code=401, detail="Code invalide")

    token = generate_token()
    store_token(token, str(artist.id))

    return {
        "token": token,
        "artist": {
            "id": str(artist.id),
            "name": artist.name,
            "email": artist.email,
            "artwork_url": artist.image_url,
        }
    }


@router.get("/debug-config")
async def debug_config():
    """Debug endpoint to check Supabase configuration (no sensitive data)."""
    import os
    return {
        "supabase_url_set": bool(settings.SUPABASE_URL),
        "supabase_url_value": settings.SUPABASE_URL[:30] + "..." if settings.SUPABASE_URL else None,
        "supabase_anon_key_set": bool(settings.SUPABASE_ANON_KEY),
        "supabase_anon_key_prefix": settings.SUPABASE_ANON_KEY[:20] + "..." if settings.SUPABASE_ANON_KEY else None,
        "supabase_service_key_set": bool(settings.SUPABASE_SERVICE_ROLE_KEY),
        "supabase_service_key_prefix": settings.SUPABASE_SERVICE_ROLE_KEY[:20] + "..." if settings.SUPABASE_SERVICE_ROLE_KEY else None,
        "env_supabase_url": os.getenv("SUPABASE_URL", "NOT SET")[:30] if os.getenv("SUPABASE_URL") else "NOT SET",
        "env_supabase_anon_key": os.getenv("SUPABASE_ANON_KEY", "NOT SET")[:20] if os.getenv("SUPABASE_ANON_KEY") else "NOT SET",
        "env_supabase_service_key": os.getenv("SUPABASE_SERVICE_ROLE_KEY", "NOT SET")[:20] if os.getenv("SUPABASE_SERVICE_ROLE_KEY") else "NOT SET",
    }


@router.get("/list-supabase-users")
async def list_supabase_users():
    """List all users in Supabase Auth (admin only)."""
    import os
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase_url = os.getenv("SUPABASE_URL", "https://huolkgcnizwrhzyboemd.supabase.co")

    if not service_key:
        raise HTTPException(status_code=500, detail="Supabase service key not configured")

    try:
        from supabase import create_client
        supabase = create_client(supabase_url, service_key)

        # List users
        users_response = supabase.auth.admin.list_users()

        users = []
        for user in users_response:
            users.append({
                "id": user.id,
                "email": user.email,
                "created_at": user.created_at,
                "email_confirmed": user.email_confirmed_at is not None,
            })

        return {"count": len(users), "users": users}

    except Exception as e:
        logger.error(f"Failed to list users: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password for a Supabase user by email (admin only)."""
    import os
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase_url = os.getenv("SUPABASE_URL", "https://huolkgcnizwrhzyboemd.supabase.co")

    if not service_key:
        raise HTTPException(status_code=500, detail="Supabase service key not configured")

    try:
        from supabase import create_client
        supabase = create_client(supabase_url, service_key)

        # Find user by email
        users_response = supabase.auth.admin.list_users()
        user_id = None
        for user in users_response:
            if user.email == request.email:
                user_id = user.id
                break

        if not user_id:
            raise HTTPException(status_code=404, detail=f"User with email {request.email} not found in Supabase")

        # Update password
        supabase.auth.admin.update_user_by_id(
            user_id,
            {"password": request.new_password}
        )

        return {"message": f"Password updated for {request.email}", "user_id": user_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reset password: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/login-email", response_model=LoginResponse)
async def login_email(request: EmailLoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password via Supabase Auth."""
    import os
    # Read directly from env to bypass lru_cache
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    supabase_url = os.getenv("SUPABASE_URL", "https://huolkgcnizwrhzyboemd.supabase.co")

    if not anon_key:
        logger.error("SUPABASE_ANON_KEY not set in environment")
        raise HTTPException(status_code=500, detail="Supabase non configuré")

    try:
        from supabase import create_client
        supabase = create_client(supabase_url, anon_key)

        # Authenticate with Supabase
        auth_response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })

        if not auth_response or not auth_response.user:
            raise HTTPException(status_code=401, detail="Email ou mot de passe invalide")

        auth_user_id = auth_response.user.id

        # Find artist by auth_user_id
        result = await db.execute(
            select(Artist).where(Artist.auth_user_id == auth_user_id)
        )
        artist = result.scalar_one_or_none()

        if not artist:
            # Try to find by email as fallback
            result = await db.execute(
                select(Artist).where(Artist.email == request.email)
            )
            artist = result.scalar_one_or_none()

            if artist:
                # Link the auth_user_id to the artist
                artist.auth_user_id = auth_user_id
                await db.commit()
            else:
                raise HTTPException(status_code=401, detail="Aucun artiste associé à ce compte")

        # Return the Supabase access token
        return {
            "token": auth_response.session.access_token,
            "artist": {
                "id": str(artist.id),
                "name": artist.name,
                "email": artist.email,
                "artwork_url": artist.image_url,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Supabase login error: {e}")
        raise HTTPException(status_code=401, detail="Email ou mot de passe invalide")


@router.post("/create-auth")
async def create_artist_auth(
    request: CreateArtistAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create Supabase auth account for an artist (admin only)."""
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase non configuré")

    # Find the artist
    result = await db.execute(
        select(Artist).where(Artist.id == uuid.UUID(request.artist_id))
    )
    artist = result.scalar_one_or_none()

    if not artist:
        raise HTTPException(status_code=404, detail="Artiste non trouvé")

    try:
        supabase = get_supabase_client()

        # Create user in Supabase Auth
        auth_response = supabase.auth.admin.create_user({
            "email": request.email,
            "password": request.password,
            "email_confirm": True,  # Auto-confirm email
            "user_metadata": {
                "artist_id": str(artist.id),
                "artist_name": artist.name,
            }
        })

        if not auth_response or not auth_response.user:
            raise HTTPException(status_code=500, detail="Erreur lors de la création du compte")

        # Update artist with auth_user_id and email
        artist.auth_user_id = auth_response.user.id
        artist.email = request.email
        await db.commit()

        return {
            "message": "Compte créé avec succès",
            "artist_id": str(artist.id),
            "auth_user_id": auth_response.user.id,
            "email": request.email,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Supabase create user error: {e}")
        # Check if user already exists
        if "already been registered" in str(e).lower() or "already exists" in str(e).lower():
            raise HTTPException(status_code=400, detail="Un compte avec cet email existe déjà")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")


@router.get("/me", response_model=ArtistInfo)
async def get_me(artist: Artist = Depends(get_current_artist)):
    """Get current artist info."""
    return {
        "id": str(artist.id),
        "name": artist.name,
        "email": artist.email,
        "artwork_url": artist.image_url,
    }


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Get artist dashboard with summary statistics."""
    # Get total revenue
    revenue_result = await db.execute(
        select(
            func.coalesce(func.sum(TransactionNormalized.gross_amount), 0).label("gross"),
            func.coalesce(func.sum(TransactionNormalized.quantity), 0).label("streams"),
        ).where(TransactionNormalized.artist_name == artist.name)
    )
    revenue_row = revenue_result.one()
    total_gross = float(revenue_row.gross)
    total_streams = int(revenue_row.streams)

    # Get advance balance (avances)
    advances_result = await db.execute(
        select(func.coalesce(func.sum(AdvanceLedgerEntry.amount), 0)).where(
            and_(
                AdvanceLedgerEntry.artist_id == artist.id,
                AdvanceLedgerEntry.entry_type == "advance",
            )
        )
    )
    advance_balance = float(advances_result.scalar() or 0)

    # Get payments (reduce advance balance)
    payments_result = await db.execute(
        select(func.coalesce(func.sum(AdvanceLedgerEntry.amount), 0)).where(
            and_(
                AdvanceLedgerEntry.artist_id == artist.id,
                AdvanceLedgerEntry.entry_type == "payment",
            )
        )
    )
    payments_total = float(payments_result.scalar() or 0)

    # Use default 50% artist share for now (contract logic would require eager loading)
    artist_share = 0.5

    # Calculate net from statements - sum of unpaid statements' net_payable
    statements_result = await db.execute(
        select(func.coalesce(func.sum(Statement.net_payable), 0)).where(
            and_(
                Statement.artist_id == artist.id,
                Statement.status != "paid",
            )
        )
    )
    total_net = float(statements_result.scalar() or 0)

    # Count releases and tracks
    releases_result = await db.execute(
        select(func.count(func.distinct(TransactionNormalized.upc))).where(
            and_(
                TransactionNormalized.artist_name == artist.name,
                TransactionNormalized.upc.isnot(None),
            )
        )
    )
    release_count = releases_result.scalar() or 0

    tracks_result = await db.execute(
        select(func.count(func.distinct(TransactionNormalized.isrc))).where(
            and_(
                TransactionNormalized.artist_name == artist.name,
                TransactionNormalized.isrc.isnot(None),
            )
        )
    )
    track_count = tracks_result.scalar() or 0

    return {
        "artist": {
            "id": str(artist.id),
            "name": artist.name,
            "artwork_url": artist.image_url,
        },
        "total_gross": f"{total_gross:.2f}",
        "total_net": f"{total_net:.2f}",
        "total_streams": total_streams,
        "advance_balance": f"{advance_balance:.2f}",
        "currency": "EUR",
        "release_count": release_count,
        "track_count": track_count,
    }


@router.get("/releases", response_model=List[ReleaseResponse])
async def get_releases(
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Get artist's releases with revenue."""
    from app.models.contract import Contract

    result = await db.execute(
        select(
            TransactionNormalized.upc,
            TransactionNormalized.release_title,
            func.sum(TransactionNormalized.gross_amount).label("gross"),
            func.sum(TransactionNormalized.quantity).label("streams"),
            func.count(func.distinct(TransactionNormalized.isrc)).label("track_count"),
        )
        .where(
            and_(
                TransactionNormalized.artist_name == artist.name,
                TransactionNormalized.upc.isnot(None),
            )
        )
        .group_by(TransactionNormalized.upc, TransactionNormalized.release_title)
        .order_by(func.sum(TransactionNormalized.gross_amount).desc())
    )

    rows = result.all()

    # Get artwork for all UPCs
    upcs = [row.upc for row in rows if row.upc]
    artwork_result = await db.execute(
        select(ReleaseArtwork).where(ReleaseArtwork.upc.in_(upcs))
    )
    artworks = {a.upc: a.image_url for a in artwork_result.scalars().all()}

    # Get all contracts for this artist
    contracts_result = await db.execute(
        select(Contract).where(Contract.artist_id == artist.id)
    )
    contracts = contracts_result.scalars().all()

    # Build contract lookup: UPC -> artist_share
    contract_shares = {}
    catalog_share = 0.5  # Default fallback

    for contract in contracts:
        if contract.scope == "catalog":
            catalog_share = float(contract.artist_share)
        elif contract.scope == "release" and contract.scope_id:
            contract_shares[contract.scope_id] = float(contract.artist_share)

    releases = []
    for row in rows:
        gross = float(row.gross or 0)
        # Use release-specific contract if exists, otherwise catalog default
        artist_share = contract_shares.get(row.upc, catalog_share)
        net = gross * artist_share

        releases.append({
            "upc": row.upc,
            "title": row.release_title or "Unknown",
            "artwork_url": artworks.get(row.upc),
            "gross": f"{gross:.2f}",
            "net": f"{net:.2f}",
            "streams": int(row.streams or 0),
            "track_count": int(row.track_count or 0),
            "currency": "EUR",
        })

    return releases


@router.get("/tracks", response_model=List[TrackResponse])
async def get_tracks(
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Get artist's tracks with revenue."""
    from app.models.contract import Contract

    result = await db.execute(
        select(
            TransactionNormalized.isrc,
            TransactionNormalized.upc,
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
            func.sum(TransactionNormalized.gross_amount).label("gross"),
            func.sum(TransactionNormalized.quantity).label("streams"),
        )
        .where(
            and_(
                TransactionNormalized.artist_name == artist.name,
                TransactionNormalized.isrc.isnot(None),
            )
        )
        .group_by(
            TransactionNormalized.isrc,
            TransactionNormalized.upc,
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
        )
        .order_by(func.sum(TransactionNormalized.gross_amount).desc())
    )

    rows = result.all()

    # Get artwork for all ISRCs
    isrcs = [row.isrc for row in rows if row.isrc]
    artwork_result = await db.execute(
        select(TrackArtwork).where(TrackArtwork.isrc.in_(isrcs))
    )
    artworks = {a.isrc: a.image_url for a in artwork_result.scalars().all()}

    # Get all contracts for this artist
    contracts_result = await db.execute(
        select(Contract).where(Contract.artist_id == artist.id)
    )
    contracts = contracts_result.scalars().all()

    # Build contract lookup hierarchies
    track_contracts = {}  # ISRC -> artist_share
    release_contracts = {}  # UPC -> artist_share
    catalog_share = 0.5  # Default fallback

    for contract in contracts:
        if contract.scope == "catalog":
            catalog_share = float(contract.artist_share)
        elif contract.scope == "release" and contract.scope_id:
            release_contracts[contract.scope_id] = float(contract.artist_share)
        elif contract.scope == "track" and contract.scope_id:
            track_contracts[contract.scope_id] = float(contract.artist_share)

    tracks = []
    for row in rows:
        gross = float(row.gross or 0)

        # Contract hierarchy: track-specific > release-specific > catalog default
        artist_share = catalog_share
        if row.isrc in track_contracts:
            artist_share = track_contracts[row.isrc]
        elif row.upc and row.upc in release_contracts:
            artist_share = release_contracts[row.upc]

        net = gross * artist_share

        tracks.append({
            "isrc": row.isrc,
            "title": row.track_title or "Unknown",
            "release_title": row.release_title,
            "artwork_url": artworks.get(row.isrc),
            "gross": f"{gross:.2f}",
            "net": f"{net:.2f}",
            "streams": int(row.streams or 0),
            "currency": "EUR",
        })

    return tracks


@router.get("/payments", response_model=List[PaymentResponse])
async def get_payments(
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Get artist's payment history."""
    result = await db.execute(
        select(AdvanceLedgerEntry)
        .where(
            and_(
                AdvanceLedgerEntry.artist_id == artist.id,
                AdvanceLedgerEntry.entry_type == "payment",
            )
        )
        .order_by(AdvanceLedgerEntry.effective_date.desc())
    )

    payments = []
    for entry in result.scalars().all():
        payments.append({
            "id": str(entry.id),
            "amount": f"{float(entry.amount):.2f}",
            "currency": entry.currency,
            "date": entry.effective_date.isoformat() if entry.effective_date else entry.created_at.isoformat(),
            "description": entry.description,
        })

    return payments


@router.get("/platforms", response_model=List[PlatformStatsResponse])
async def get_platform_stats(
    year: Optional[int] = None,
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Get revenue breakdown by platform."""
    query = select(
        TransactionNormalized.store_name,
        func.sum(TransactionNormalized.gross_amount).label("gross"),
        func.sum(TransactionNormalized.quantity).label("streams"),
    ).where(TransactionNormalized.artist_name == artist.name)

    if year:
        query = query.where(
            func.extract("year", TransactionNormalized.period_start) == year
        )

    query = query.group_by(TransactionNormalized.store_name).order_by(
        func.sum(TransactionNormalized.gross_amount).desc()
    )

    result = await db.execute(query)
    rows = result.all()

    # Calculate total for percentages
    total = sum(float(row.gross or 0) for row in rows)

    # Platform label mapping
    platform_labels = {
        "spotify": "Spotify",
        "apple_music": "Apple Music",
        "deezer": "Deezer",
        "youtube_music": "YouTube Music",
        "amazon_music": "Amazon Music",
        "tidal": "Tidal",
        "bandcamp": "Bandcamp",
        "soundcloud": "SoundCloud",
        "believe": "Believe",
        "tunecore": "TuneCore",
    }

    stats = []
    for row in rows:
        gross = float(row.gross or 0)
        percentage = (gross / total * 100) if total > 0 else 0
        source = row.store_name or "other"
        stats.append({
            "platform": source.lower().replace(" ", "_"),
            "platform_label": platform_labels.get(source.lower().replace(" ", "_"), source),
            "gross": f"{gross:.2f}",
            "streams": int(row.streams or 0),
            "percentage": percentage,
        })

    return stats


@router.get("/expenses", response_model=List[ExpenseResponse])
async def get_expenses(
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Get label expenses for the artist."""
    # Category labels in French
    category_labels = {
        "mastering": "Mastering",
        "mixing": "Mixage",
        "recording": "Enregistrement",
        "photos": "Photos",
        "video": "Vidéo",
        "advertising": "Publicité",
        "groover": "Groover",
        "submithub": "SubmitHub",
        "google_ads": "Google Ads",
        "instagram": "Instagram",
        "tiktok": "TikTok",
        "facebook": "Facebook",
        "spotify_ads": "Spotify Ads",
        "pr": "Relations Presse",
        "distribution": "Distribution",
        "artwork": "Artwork",
        "cd": "CD",
        "vinyl": "Vinyle",
        "goodies": "Goodies",
        "accommodation": "Hébergement",
        "equipment_rental": "Location équipement",
        "other": "Autre",
    }

    result = await db.execute(
        select(AdvanceLedgerEntry)
        .where(
            and_(
                AdvanceLedgerEntry.artist_id == artist.id,
                AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE,
            )
        )
        .order_by(AdvanceLedgerEntry.effective_date.desc())
    )

    expenses = []
    for entry in result.scalars().all():
        # Get scope title if applicable
        scope_title = None
        if entry.scope == "release" and entry.scope_id:
            artwork_result = await db.execute(
                select(ReleaseArtwork).where(ReleaseArtwork.upc == entry.scope_id)
            )
            artwork = artwork_result.scalar_one_or_none()
            scope_title = artwork.name if artwork else entry.scope_id
        elif entry.scope == "track" and entry.scope_id:
            track_result = await db.execute(
                select(TrackArtwork).where(TrackArtwork.isrc == entry.scope_id)
            )
            track = track_result.scalar_one_or_none()
            scope_title = track.name if track else entry.scope_id

        expenses.append({
            "id": str(entry.id),
            "amount": f"{float(entry.amount):.2f}",
            "currency": entry.currency,
            "category": entry.category,
            "category_label": category_labels.get(entry.category, entry.category) if entry.category else None,
            "scope": entry.scope,
            "scope_title": scope_title,
            "description": entry.description,
            "date": entry.effective_date.strftime("%Y-%m-%d") if entry.effective_date else entry.created_at.strftime("%Y-%m-%d"),
        })

    return expenses


@router.get("/contracts", response_model=List[ContractResponse])
async def get_contracts(
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Get contracts for the artist."""
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Contract)
        .options(selectinload(Contract.parties))
        .where(Contract.artist_id == artist.id)
        .order_by(Contract.start_date.desc())
    )

    contracts = []
    for contract in result.scalars().all():
        # Calculate shares
        artist_share = 0.0
        label_share = 0.0
        for party in contract.parties:
            if party.party_type == "artist":
                artist_share += float(party.share_percent or 0)
            else:
                label_share += float(party.share_percent or 0)

        # Get scope title
        scope_title = None
        if contract.scope == "release" and contract.scope_id:
            artwork_result = await db.execute(
                select(ReleaseArtwork).where(ReleaseArtwork.upc == contract.scope_id)
            )
            artwork = artwork_result.scalar_one_or_none()
            scope_title = artwork.name if artwork else contract.scope_id
        elif contract.scope == "track" and contract.scope_id:
            track_result = await db.execute(
                select(TrackArtwork).where(TrackArtwork.isrc == contract.scope_id)
            )
            track = track_result.scalar_one_or_none()
            scope_title = track.name if track else contract.scope_id

        contracts.append({
            "id": str(contract.id),
            "scope": contract.scope or "catalog",
            "scope_id": contract.scope_id,
            "scope_title": scope_title,
            "start_date": contract.start_date.strftime("%Y-%m-%d") if contract.start_date else None,
            "end_date": contract.end_date.strftime("%Y-%m-%d") if contract.end_date else None,
            "artist_share": artist_share,
            "label_share": label_share,
            "description": contract.description,
        })

    return contracts


@router.get("/revenue-quarterly", response_model=List[QuarterlyRevenueResponse])
async def get_quarterly_revenue(
    year: Optional[int] = None,
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Get revenue breakdown by quarter."""
    from datetime import date
    current_year = year or date.today().year

    # Get monthly revenue
    result = await db.execute(
        select(
            func.extract("month", TransactionNormalized.period_start).label("month"),
            func.sum(TransactionNormalized.gross_amount).label("gross"),
            func.sum(TransactionNormalized.quantity).label("streams"),
        )
        .where(
            and_(
                TransactionNormalized.artist_name == artist.name,
                func.extract("year", TransactionNormalized.period_start) == current_year,
            )
        )
        .group_by(func.extract("month", TransactionNormalized.period_start))
    )

    # Aggregate by quarter
    quarters = {1: {"gross": 0, "streams": 0}, 2: {"gross": 0, "streams": 0}, 3: {"gross": 0, "streams": 0}, 4: {"gross": 0, "streams": 0}}

    for row in result.all():
        month = int(row.month)
        quarter = (month - 1) // 3 + 1
        quarters[quarter]["gross"] += float(row.gross or 0)
        quarters[quarter]["streams"] += int(row.streams or 0)

    quarterly_data = []
    for q in range(1, 5):
        gross = quarters[q]["gross"]
        net = gross * 0.5  # Default 50% share
        quarterly_data.append({
            "quarter": f"Q{q}",
            "year": current_year,
            "gross": f"{gross:.2f}",
            "net": f"{net:.2f}",
            "streams": quarters[q]["streams"],
            "currency": "EUR",
        })

    return quarterly_data


@router.get("/label-settings", response_model=LabelSettingsResponse)
async def get_label_settings(
    db: AsyncSession = Depends(get_db),
):
    """Get label settings (logo, name) for display in artist portal."""
    result = await db.execute(select(LabelSettings).limit(1))
    settings = result.scalar_one_or_none()

    if not settings:
        return {"label_name": None, "logo_url": None, "logo_base64": None}

    return {
        "label_name": settings.label_name,
        "logo_url": settings.logo_url,
        "logo_base64": settings.logo_base64,
    }


@router.get("/statements", response_model=List[StatementResponse])
async def get_statements(
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Get royalty statements for the artist."""
    result = await db.execute(
        select(Statement)
        .where(Statement.artist_id == artist.id)
        .order_by(Statement.period_end.desc())
    )

    statements = []
    for stmt in result.scalars().all():
        # Generate period label as quarter (Q1-Q4)
        quarter = (stmt.period_start.month - 1) // 3 + 1
        period_label = f"Q{quarter} {stmt.period_start.year}"

        statements.append({
            "id": str(stmt.id),
            "period_start": stmt.period_start.isoformat(),
            "period_end": stmt.period_end.isoformat(),
            "period_label": period_label,
            "gross_revenue": f"{float(stmt.gross_revenue):.2f}",
            "artist_royalties": f"{float(stmt.artist_royalties):.2f}",
            "recouped": f"{float(stmt.recouped):.2f}",
            "net_payable": f"{float(stmt.net_payable):.2f}",
            "currency": stmt.currency,
            "status": stmt.status.value if hasattr(stmt.status, 'value') else stmt.status,
            "created_at": stmt.created_at.isoformat(),
        })

    return statements


@router.get("/statements/{statement_id}", response_model=StatementDetailResponse)
async def get_statement_detail(
    statement_id: str,
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed breakdown of a royalty statement."""
    # Get the statement
    result = await db.execute(
        select(Statement)
        .where(Statement.id == uuid.UUID(statement_id))
        .where(Statement.artist_id == artist.id)
    )
    stmt = result.scalar_one_or_none()

    if not stmt:
        raise HTTPException(status_code=404, detail="Relevé non trouvé")

    # Get line items from the royalty run
    items_result = await db.execute(
        select(RoyaltyLineItem)
        .where(RoyaltyLineItem.royalty_run_id == stmt.royalty_run_id)
        .where(RoyaltyLineItem.artist_id == artist.id)
    )
    line_items = items_result.scalars().all()

    # Aggregate by release (UPC)
    releases_dict = {}
    for item in line_items:
        upc = item.upc or "unknown"
        if upc not in releases_dict:
            releases_dict[upc] = {
                "upc": upc,
                "title": item.release_title or "Unknown",
                "gross": 0.0,
                "artist_royalties": 0.0,
                "tracks": set(),
            }
        releases_dict[upc]["gross"] += float(item.gross_amount or 0)
        releases_dict[upc]["artist_royalties"] += float(item.artist_amount or 0)
        if item.isrc:
            releases_dict[upc]["tracks"].add(item.isrc)

    releases = [
        {
            "upc": r["upc"],
            "title": r["title"],
            "gross": f"{r['gross']:.2f}",
            "artist_royalties": f"{r['artist_royalties']:.2f}",
            "track_count": len(r["tracks"]),
        }
        for r in sorted(releases_dict.values(), key=lambda x: x["artist_royalties"], reverse=True)
    ]

    # Aggregate by source - get store_name from transactions
    sources_dict = {}
    for item in line_items:
        # Get store name from transaction
        tx_result = await db.execute(
            select(TransactionNormalized.store_name)
            .where(TransactionNormalized.id == item.transaction_id)
        )
        store = tx_result.scalar_one_or_none() or "other"

        if store not in sources_dict:
            sources_dict[store] = {
                "source": store.lower().replace(" ", "_"),
                "gross": 0.0,
                "artist_royalties": 0.0,
                "count": 0,
            }
        sources_dict[store]["gross"] += float(item.gross_amount or 0)
        sources_dict[store]["artist_royalties"] += float(item.artist_amount or 0)
        sources_dict[store]["count"] += 1

    platform_labels = {
        "spotify": "Spotify",
        "apple_music": "Apple Music",
        "deezer": "Deezer",
        "youtube_music": "YouTube Music",
        "amazon_music": "Amazon Music",
        "tidal": "Tidal",
        "bandcamp": "Bandcamp",
        "soundcloud": "SoundCloud",
        "believe": "Believe",
        "tunecore": "TuneCore",
    }

    sources = [
        {
            "source": s["source"],
            "source_label": platform_labels.get(s["source"], store),
            "gross": f"{s['gross']:.2f}",
            "artist_royalties": f"{s['artist_royalties']:.2f}",
            "transaction_count": s["count"],
        }
        for store, s in sorted(sources_dict.items(), key=lambda x: x[1]["artist_royalties"], reverse=True)
    ]

    # Generate period label as quarter
    quarter = (stmt.period_start.month - 1) // 3 + 1
    period_label = f"Q{quarter} {stmt.period_start.year}"

    return {
        "id": str(stmt.id),
        "period_start": stmt.period_start.isoformat(),
        "period_end": stmt.period_end.isoformat(),
        "period_label": period_label,
        "gross_revenue": f"{float(stmt.gross_revenue):.2f}",
        "artist_royalties": f"{float(stmt.artist_royalties):.2f}",
        "recouped": f"{float(stmt.recouped):.2f}",
        "net_payable": f"{float(stmt.net_payable):.2f}",
        "advance_balance": f"{float(stmt.advance_balance_before):.2f}",
        "currency": stmt.currency,
        "status": stmt.status.value if hasattr(stmt.status, 'value') else stmt.status,
        "created_at": stmt.created_at.isoformat(),
        "releases": releases,
        "sources": sources,
    }


# ============ Admin endpoint to generate access codes ============

@router.post("/generate-code/{artist_id}")
async def generate_access_code(
    artist_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Generate an access code for an artist (admin only)."""
    result = await db.execute(select(Artist).where(Artist.id == uuid.UUID(artist_id)))
    artist = result.scalar_one_or_none()

    if not artist:
        raise HTTPException(status_code=404, detail="Artiste non trouvé")

    # Generate a simple 8-character code
    code = secrets.token_hex(4).upper()

    # Update the artist directly via ORM
    artist.access_code = code
    # Don't call commit - let get_db handle it
    print(f"DEBUG: Setting code {code} for artist {artist.name}")

    return {"access_code": code}


# ============ Profile Schemas ============

class ArtistProfileResponse(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    bank_name: Optional[str] = None
    account_holder: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    siret: Optional[str] = None
    vat_number: Optional[str] = None


class ArtistProfileUpdate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    bank_name: Optional[str] = None
    account_holder: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    siret: Optional[str] = None
    vat_number: Optional[str] = None


class SocialMediaUpdate(BaseModel):
    """Update social media links."""
    instagram_url: Optional[str] = None
    twitter_url: Optional[str] = None
    facebook_url: Optional[str] = None
    tiktok_url: Optional[str] = None
    youtube_url: Optional[str] = None


class SocialMediaResponse(BaseModel):
    """Social media links response."""
    instagram_url: Optional[str] = None
    twitter_url: Optional[str] = None
    facebook_url: Optional[str] = None
    tiktok_url: Optional[str] = None
    youtube_url: Optional[str] = None


class PaymentRequestBody(BaseModel):
    statement_id: str
    message: Optional[str] = None


# Field labels for notifications
PROFILE_FIELD_LABELS = {
    "email": "Email",
    "phone": "Telephone",
    "address_line1": "Adresse ligne 1",
    "address_line2": "Adresse ligne 2",
    "city": "Ville",
    "postal_code": "Code postal",
    "country": "Pays",
    "bank_name": "Nom de la banque",
    "account_holder": "Titulaire du compte",
    "iban": "IBAN",
    "bic": "BIC",
    "siret": "SIRET",
    "vat_number": "Numero de TVA",
}


# ============ Profile Endpoints ============

@router.get("/profile", response_model=ArtistProfileResponse)
async def get_profile(
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Get artist profile information."""
    result = await db.execute(
        select(ArtistProfile).where(ArtistProfile.artist_id == artist.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        return ArtistProfileResponse()

    return ArtistProfileResponse(
        email=profile.email,
        phone=profile.phone,
        address_line1=profile.address_line1,
        address_line2=profile.address_line2,
        city=profile.city,
        postal_code=profile.postal_code,
        country=profile.country,
        bank_name=profile.bank_name,
        account_holder=profile.account_holder,
        iban=profile.iban,
        bic=profile.bic,
        siret=profile.siret,
        vat_number=profile.vat_number,
    )


@router.put("/profile", response_model=ArtistProfileResponse)
async def update_profile(
    data: ArtistProfileUpdate,
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Update artist profile information."""
    from app.services.email_service import send_profile_update_notification

    # Get or create profile
    result = await db.execute(
        select(ArtistProfile).where(ArtistProfile.artist_id == artist.id)
    )
    profile = result.scalar_one_or_none()

    changed_fields = []

    if not profile:
        profile = ArtistProfile(artist_id=artist.id)
        db.add(profile)
        # Track all non-null fields as changes for new profile
        for field, value in data.model_dump().items():
            if value is not None:
                changed_fields.append(PROFILE_FIELD_LABELS.get(field, field))
    else:
        # Track changed fields
        for field, value in data.model_dump().items():
            if value is not None:
                old_value = getattr(profile, field, None)
                if old_value != value:
                    changed_fields.append(PROFILE_FIELD_LABELS.get(field, field))

    # Update fields
    for field, value in data.model_dump().items():
        if value is not None:
            setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)

    # Create notification and send email if fields changed
    if changed_fields:
        # Create notification in database
        notification = Notification(
            notification_type=NotificationType.PROFILE_UPDATE.value,
            artist_id=artist.id,
            title=f"Profil mis a jour - {artist.name}",
            message=f"Champs modifies: {', '.join(changed_fields)}",
            data=json.dumps({"changed_fields": changed_fields}),
        )
        db.add(notification)
        await db.commit()

        # Send email notification (async, don't wait)
        try:
            await send_profile_update_notification(
                artist_name=artist.name,
                artist_id=str(artist.id),
                changed_fields=changed_fields,
            )
        except Exception as e:
            print(f"Failed to send profile update email: {e}")

    return ArtistProfileResponse(
        email=profile.email,
        phone=profile.phone,
        address_line1=profile.address_line1,
        address_line2=profile.address_line2,
        city=profile.city,
        postal_code=profile.postal_code,
        country=profile.country,
        bank_name=profile.bank_name,
        account_holder=profile.account_holder,
        iban=profile.iban,
        bic=profile.bic,
        siret=profile.siret,
        vat_number=profile.vat_number,
    )


@router.get("/social-media", response_model=SocialMediaResponse)
async def get_social_media(
    artist: Artist = Depends(get_current_artist),
):
    """Get artist social media links."""
    return SocialMediaResponse(
        instagram_url=artist.instagram_url,
        twitter_url=artist.twitter_url,
        facebook_url=artist.facebook_url,
        tiktok_url=artist.tiktok_url,
        youtube_url=artist.youtube_url,
    )


@router.put("/social-media", response_model=SocialMediaResponse)
async def update_social_media(
    data: SocialMediaUpdate,
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Update artist social media links."""
    # Update fields
    if data.instagram_url is not None:
        artist.instagram_url = data.instagram_url or None
    if data.twitter_url is not None:
        artist.twitter_url = data.twitter_url or None
    if data.facebook_url is not None:
        artist.facebook_url = data.facebook_url or None
    if data.tiktok_url is not None:
        artist.tiktok_url = data.tiktok_url or None
    if data.youtube_url is not None:
        artist.youtube_url = data.youtube_url or None

    await db.commit()
    await db.refresh(artist)

    return SocialMediaResponse(
        instagram_url=artist.instagram_url,
        twitter_url=artist.twitter_url,
        facebook_url=artist.facebook_url,
        tiktok_url=artist.tiktok_url,
        youtube_url=artist.youtube_url,
    )


@router.post("/request-payment")
async def request_payment(
    data: PaymentRequestBody,
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Request payment for a statement."""
    from app.services.email_service import send_payment_request_email

    # Get the statement
    result = await db.execute(
        select(Statement)
        .where(Statement.id == uuid.UUID(data.statement_id))
        .where(Statement.artist_id == artist.id)
    )
    stmt = result.scalar_one_or_none()

    if not stmt:
        raise HTTPException(status_code=404, detail="Releve non trouve")

    if stmt.status == "paid":
        raise HTTPException(status_code=400, detail="Ce releve a deja ete paye")

    # Get artist profile
    profile_result = await db.execute(
        select(ArtistProfile).where(ArtistProfile.artist_id == artist.id)
    )
    profile = profile_result.scalar_one_or_none()

    # Prepare bank details and contact info
    bank_details = None
    contact_info = None

    if profile:
        bank_details = {
            "bank_name": profile.bank_name,
            "account_holder": profile.account_holder,
            "iban": profile.iban,
            "bic": profile.bic,
        }
        contact_info = {
            "email": profile.email,
            "phone": profile.phone,
            "address_line1": profile.address_line1,
            "address_line2": profile.address_line2,
            "city": profile.city,
            "postal_code": profile.postal_code,
            "country": profile.country,
            "siret": profile.siret,
            "vat_number": profile.vat_number,
        }

    # Generate period label
    quarter = (stmt.period_start.month - 1) // 3 + 1
    period_label = f"Q{quarter} {stmt.period_start.year}"

    # Create notification
    notification = Notification(
        notification_type=NotificationType.PAYMENT_REQUEST.value,
        artist_id=artist.id,
        title=f"Demande de paiement - {artist.name}",
        message=f"Demande de paiement de {float(stmt.net_payable):.2f} {stmt.currency} pour {period_label}",
        data=json.dumps({
            "statement_id": str(stmt.id),
            "amount": str(stmt.net_payable),
            "currency": stmt.currency,
            "period_label": period_label,
        }),
    )
    db.add(notification)
    await db.commit()

    # Send email
    try:
        await send_payment_request_email(
            artist_name=artist.name,
            artist_email=profile.email if profile else artist.email,
            period_label=period_label,
            amount=f"{float(stmt.net_payable):.2f}",
            currency=stmt.currency,
            bank_details=bank_details,
            contact_info=contact_info,
        )
    except Exception as e:
        print(f"Failed to send payment request email: {e}")
        # Don't fail the request if email fails

    return {"message": "Demande de paiement envoyee", "statement_id": str(stmt.id)}


# ============ Notifications Endpoint (for admin) ============

@router.get("/notifications")
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Get notifications for admin dashboard."""
    query = select(Notification).order_by(Notification.created_at.desc()).limit(limit)

    if unread_only:
        query = query.where(Notification.is_read == False)

    result = await db.execute(query)
    notifications = result.scalars().all()

    # Get artist names
    artist_ids = [n.artist_id for n in notifications if n.artist_id]
    artists_result = await db.execute(
        select(Artist).where(Artist.id.in_(artist_ids))
    )
    artists_map = {a.id: a.name for a in artists_result.scalars().all()}

    return [
        {
            "id": str(n.id),
            "type": n.notification_type,
            "artist_id": str(n.artist_id) if n.artist_id else None,
            "artist_name": artists_map.get(n.artist_id) if n.artist_id else None,
            "title": n.title,
            "message": n.message,
            "data": json.loads(n.data) if n.data else None,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifications
    ]


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read."""
    result = await db.execute(
        select(Notification).where(Notification.id == uuid.UUID(notification_id))
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification non trouvee")

    notification.is_read = True
    await db.commit()

    return {"message": "Notification marquee comme lue"}


@router.put("/notifications/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read."""
    from sqlalchemy import update

    await db.execute(
        update(Notification).where(Notification.is_read == False).values(is_read=True)
    )
    await db.commit()

    return {"message": "Toutes les notifications marquees comme lues"}


# ============ Tickets / Support ============

class TicketCreateRequest(BaseModel):
    """Create a new support ticket."""
    subject: str
    category: str
    message: str


class TicketMessageCreate(BaseModel):
    """Add a message to a ticket."""
    message: str


class TicketMessageResponse(BaseModel):
    """Ticket message response."""
    id: str
    message: str
    sender_type: str
    sender_name: Optional[str]
    is_internal: bool
    created_at: str


class TicketResponse(BaseModel):
    """Ticket list item response."""
    id: str
    ticket_number: str
    subject: str
    category: str
    category_label: str
    status: str
    status_label: str
    priority: str
    unread_count: int
    last_message_at: str
    created_at: str


class TicketDetailResponse(BaseModel):
    """Detailed ticket response with messages."""
    id: str
    ticket_number: str
    subject: str
    category: str
    category_label: str
    status: str
    status_label: str
    priority: str
    priority_label: str
    messages: List[TicketMessageResponse]
    participants: List[str]  # Artist names
    created_at: str
    updated_at: str
    resolved_at: Optional[str]


# Category labels
CATEGORY_LABELS = {
    "payment": "Paiements",
    "profile": "Profil",
    "technical": "Technique",
    "royalties": "Royalties",
    "contracts": "Contrats",
    "catalog": "Catalogue",
    "general": "Général",
    "other": "Autre",
}

# Status labels
STATUS_LABELS = {
    "open": "Ouvert",
    "in_progress": "En cours",
    "resolved": "Résolu",
    "closed": "Fermé",
}

# Priority labels
PRIORITY_LABELS = {
    "low": "Basse",
    "medium": "Moyenne",
    "high": "Haute",
    "urgent": "Urgente",
}


async def verify_artist_access_to_ticket(
    ticket_id: uuid.UUID,
    artist_id: uuid.UUID,
    db: AsyncSession,
) -> Ticket:
    """Verify artist has access to ticket (creator or participant)."""
    result = await db.execute(
        select(Ticket)
        .outerjoin(TicketParticipant)
        .where(
            and_(
                Ticket.id == ticket_id,
                (
                    (Ticket.artist_id == artist_id) |
                    (TicketParticipant.artist_id == artist_id)
                )
            )
        )
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    return ticket


@router.get("/tickets", response_model=List[TicketResponse])
async def get_my_tickets(
    status: Optional[str] = None,
    category: Optional[str] = None,
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Get all tickets for the current artist (creator or participant)."""
    # Query tickets where artist is creator OR participant
    query = (
        select(Ticket)
        .outerjoin(TicketParticipant)
        .where(
            (Ticket.artist_id == artist.id) |
            (TicketParticipant.artist_id == artist.id)
        )
    )

    # Apply filters
    if status:
        query = query.where(Ticket.status == status)
    if category:
        query = query.where(Ticket.category == category)

    # Order by last activity
    query = query.order_by(Ticket.last_message_at.desc()).distinct()

    result = await db.execute(query)
    tickets = result.scalars().all()

    # Calculate unread count for each ticket
    response = []
    for ticket in tickets:
        # Get participant record for this artist
        participant_result = await db.execute(
            select(TicketParticipant).where(
                and_(
                    TicketParticipant.ticket_id == ticket.id,
                    TicketParticipant.artist_id == artist.id,
                )
            )
        )
        participant = participant_result.scalar_one_or_none()

        # Count unread messages (messages after last_read_at)
        unread_count = 0
        if participant:
            last_read = participant.last_read_at or datetime.min
            messages_result = await db.execute(
                select(func.count(TicketMessage.id)).where(
                    and_(
                        TicketMessage.ticket_id == ticket.id,
                        TicketMessage.created_at > last_read,
                        TicketMessage.is_internal == False,
                    )
                )
            )
            unread_count = messages_result.scalar() or 0

        response.append({
            "id": str(ticket.id),
            "ticket_number": ticket.ticket_number,
            "subject": ticket.subject,
            "category": ticket.category,
            "category_label": CATEGORY_LABELS.get(ticket.category, ticket.category),
            "status": ticket.status,
            "status_label": STATUS_LABELS.get(ticket.status, ticket.status),
            "priority": ticket.priority,
            "unread_count": unread_count,
            "last_message_at": ticket.last_message_at.isoformat(),
            "created_at": ticket.created_at.isoformat(),
        })

    return response


@router.post("/tickets", response_model=TicketDetailResponse)
async def create_ticket(
    data: TicketCreateRequest,
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Create a new support ticket."""
    from sqlalchemy import text
    from app.services.email_service import send_ticket_created_notification

    # Generate ticket number using sequence
    ticket_num_result = await db.execute(text("SELECT nextval('ticket_number_seq')"))
    ticket_num = ticket_num_result.scalar()
    ticket_number = f"TKT-{ticket_num:06d}"

    # Create ticket
    ticket = Ticket(
        ticket_number=ticket_number,
        subject=data.subject,
        category=data.category,
        status=TicketStatus.OPEN.value,
        priority=TicketPriority.MEDIUM.value,
        artist_id=artist.id,
        last_message_at=datetime.utcnow(),
    )
    db.add(ticket)
    await db.flush()

    # Create first message
    message = TicketMessage(
        ticket_id=ticket.id,
        message=data.message,
        sender_type=MessageSender.ARTIST.value,
        sender_id=str(artist.id),
        sender_name=artist.name,
    )
    db.add(message)

    # Add artist as participant
    participant = TicketParticipant(
        ticket_id=ticket.id,
        artist_id=artist.id,
        last_read_at=datetime.utcnow(),
    )
    db.add(participant)

    await db.commit()
    await db.refresh(ticket)

    # Create notification for admin
    notification = Notification(
        notification_type=NotificationType.TICKET_CREATED.value,
        artist_id=artist.id,
        title=f"Nouveau ticket - {ticket_number}",
        message=f"{artist.name}: {data.subject}",
        data=json.dumps({
            "ticket_id": str(ticket.id),
            "ticket_number": ticket_number,
            "category": data.category,
        }),
    )
    db.add(notification)
    await db.commit()

    # Send email to admin
    try:
        ticket_url = f"https://admin.whalesrecords.com/tickets/{ticket.id}"
        await send_ticket_created_notification(
            ticket_number=ticket_number,
            artist_name=artist.name,
            subject=data.subject,
            category=CATEGORY_LABELS.get(data.category, data.category),
            message=data.message,
            ticket_url=ticket_url,
        )
    except Exception as e:
        logger.error(f"Failed to send ticket email: {e}")

    # Return ticket detail
    return {
        "id": str(ticket.id),
        "ticket_number": ticket_number,
        "subject": data.subject,
        "category": data.category,
        "category_label": CATEGORY_LABELS.get(data.category, data.category),
        "status": ticket.status,
        "status_label": STATUS_LABELS.get(ticket.status, ticket.status),
        "priority": ticket.priority,
        "priority_label": PRIORITY_LABELS.get(ticket.priority, ticket.priority),
        "messages": [{
            "id": str(message.id),
            "message": data.message,
            "sender_type": MessageSender.ARTIST.value,
            "sender_name": artist.name,
            "is_internal": False,
            "created_at": message.created_at.isoformat(),
        }],
        "participants": [artist.name],
        "created_at": ticket.created_at.isoformat(),
        "updated_at": ticket.updated_at.isoformat(),
        "resolved_at": None,
    }


@router.get("/tickets/{ticket_id}", response_model=TicketDetailResponse)
async def get_ticket_detail(
    ticket_id: str,
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Get ticket details with full message history."""
    ticket = await verify_artist_access_to_ticket(
        uuid.UUID(ticket_id),
        artist.id,
        db,
    )

    # Get all messages (excluding internal notes)
    messages_result = await db.execute(
        select(TicketMessage)
        .where(
            and_(
                TicketMessage.ticket_id == ticket.id,
                TicketMessage.is_internal == False,
            )
        )
        .order_by(TicketMessage.created_at)
    )
    messages = messages_result.scalars().all()

    # Get participants
    participants_result = await db.execute(
        select(Artist)
        .join(TicketParticipant)
        .where(TicketParticipant.ticket_id == ticket.id)
    )
    participants = participants_result.scalars().all()

    # Update last_read_at for this artist
    participant_result = await db.execute(
        select(TicketParticipant).where(
            and_(
                TicketParticipant.ticket_id == ticket.id,
                TicketParticipant.artist_id == artist.id,
            )
        )
    )
    participant = participant_result.scalar_one_or_none()
    if participant:
        participant.last_read_at = datetime.utcnow()
        await db.commit()

    return {
        "id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "subject": ticket.subject,
        "category": ticket.category,
        "category_label": CATEGORY_LABELS.get(ticket.category, ticket.category),
        "status": ticket.status,
        "status_label": STATUS_LABELS.get(ticket.status, ticket.status),
        "priority": ticket.priority,
        "priority_label": PRIORITY_LABELS.get(ticket.priority, ticket.priority),
        "messages": [
            {
                "id": str(m.id),
                "message": m.message,
                "sender_type": m.sender_type,
                "sender_name": m.sender_name,
                "is_internal": m.is_internal,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
        "participants": [p.name for p in participants],
        "created_at": ticket.created_at.isoformat(),
        "updated_at": ticket.updated_at.isoformat(),
        "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
    }


@router.post("/tickets/{ticket_id}/messages", response_model=TicketMessageResponse)
async def add_ticket_message(
    ticket_id: str,
    data: TicketMessageCreate,
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Add a message to a ticket."""
    from app.services.email_service import send_ticket_message_notification

    ticket = await verify_artist_access_to_ticket(
        uuid.UUID(ticket_id),
        artist.id,
        db,
    )

    # Create message
    message = TicketMessage(
        ticket_id=ticket.id,
        message=data.message,
        sender_type=MessageSender.ARTIST.value,
        sender_id=str(artist.id),
        sender_name=artist.name,
    )
    db.add(message)

    # Update ticket last_message_at
    ticket.last_message_at = datetime.utcnow()

    # If ticket was resolved, reopen it
    if ticket.status == TicketStatus.RESOLVED.value:
        ticket.status = TicketStatus.IN_PROGRESS.value
        ticket.resolved_at = None

    await db.commit()
    await db.refresh(message)

    # Create notification for admin
    notification = Notification(
        notification_type=NotificationType.TICKET_MESSAGE.value,
        artist_id=artist.id,
        title=f"Nouveau message - {ticket.ticket_number}",
        message=f"{artist.name} a répondu au ticket {ticket.ticket_number}",
        data=json.dumps({
            "ticket_id": str(ticket.id),
            "ticket_number": ticket.ticket_number,
        }),
    )
    db.add(notification)
    await db.commit()

    # Send email to admin
    try:
        ticket_url = f"https://admin.whalesrecords.com/tickets/{ticket.id}"
        await send_ticket_message_notification(
            ticket_number=ticket.ticket_number,
            subject=ticket.subject,
            sender_name=artist.name,
            message=data.message,
            recipient_emails=["royalties@whalesrecords.com"],
            ticket_url=ticket_url,
        )
    except Exception as e:
        logger.error(f"Failed to send message email: {e}")

    return {
        "id": str(message.id),
        "message": message.message,
        "sender_type": message.sender_type,
        "sender_name": message.sender_name,
        "is_internal": message.is_internal,
        "created_at": message.created_at.isoformat(),
    }


@router.put("/tickets/{ticket_id}/close")
async def close_ticket(
    ticket_id: str,
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
):
    """Close a ticket (artist confirms resolution)."""
    ticket = await verify_artist_access_to_ticket(
        uuid.UUID(ticket_id),
        artist.id,
        db,
    )

    # Only the creator can close the ticket
    if ticket.artist_id != artist.id:
        raise HTTPException(
            status_code=403,
            detail="Seul le créateur du ticket peut le fermer"
        )

    ticket.status = TicketStatus.CLOSED.value
    ticket.closed_at = datetime.utcnow()

    await db.commit()

    # Create notification for admin
    notification = Notification(
        notification_type=NotificationType.TICKET_CLOSED.value,
        artist_id=artist.id,
        title=f"Ticket fermé - {ticket.ticket_number}",
        message=f"{artist.name} a fermé le ticket {ticket.ticket_number}",
        data=json.dumps({
            "ticket_id": str(ticket.id),
            "ticket_number": ticket.ticket_number,
        }),
    )
    db.add(notification)
    await db.commit()

    return {"message": "Ticket fermé avec succès"}


# ============ Batch Create Auth Accounts ============

class BatchCreateAuthRequest(BaseModel):
    """Request to create Supabase auth accounts for all artists."""
    default_password: str = "WhalesRecords2025!"


@router.post("/create-auth-batch")
async def create_auth_batch(
    request: BatchCreateAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create Supabase auth accounts for all artists with email but no auth_user_id."""
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase non configure")

    # Find all artists with email but no auth_user_id
    result = await db.execute(
        select(Artist).where(
            and_(
                Artist.email.isnot(None),
                Artist.email != "",
                Artist.auth_user_id.is_(None),
            )
        )
    )
    artists = result.scalars().all()

    if not artists:
        return {"message": "Aucun artiste a creer", "created": 0, "errors": []}

    supabase = get_supabase_client()
    created = []
    errors = []

    for artist in artists:
        try:
            # Create user in Supabase Auth
            auth_response = supabase.auth.admin.create_user({
                "email": artist.email,
                "password": request.default_password,
                "email_confirm": True,
                "user_metadata": {
                    "artist_id": str(artist.id),
                    "artist_name": artist.name,
                }
            })

            if auth_response and auth_response.user:
                artist.auth_user_id = auth_response.user.id
                created.append({
                    "artist_id": str(artist.id),
                    "name": artist.name,
                    "email": artist.email,
                    "auth_user_id": auth_response.user.id,
                })
            else:
                errors.append({
                    "artist_id": str(artist.id),
                    "name": artist.name,
                    "email": artist.email,
                    "error": "Failed to create user",
                })

        except Exception as e:
            error_msg = str(e)
            # Check if user already exists
            if "already been registered" in error_msg.lower() or "already exists" in error_msg.lower():
                errors.append({
                    "artist_id": str(artist.id),
                    "name": artist.name,
                    "email": artist.email,
                    "error": "Email already registered in Supabase",
                })
            else:
                errors.append({
                    "artist_id": str(artist.id),
                    "name": artist.name,
                    "email": artist.email,
                    "error": error_msg,
                })

    await db.commit()

    return {
        "message": f"{len(created)} comptes crees, {len(errors)} erreurs",
        "created": len(created),
        "created_accounts": created,
        "errors": errors,
    }


# ============ Promo Endpoints ============

class PromoStatsResponse(BaseModel):
    """Artist promo stats."""
    total_submissions: int
    total_listens: int
    total_approvals: int
    total_shares: int
    total_playlists: int
    by_source: dict


class PromoSubmissionResponse(BaseModel):
    """Single promo submission for artist view."""
    id: str
    song_title: str
    source: str
    outlet_name: Optional[str] = None
    outlet_type: Optional[str] = None
    influencer_name: Optional[str] = None
    influencer_type: Optional[str] = None
    action: Optional[str] = None
    decision: Optional[str] = None
    feedback: Optional[str] = None
    listen_time: Optional[int] = None
    submitted_at: Optional[str] = None
    responded_at: Optional[str] = None
    campaign_url: Optional[str] = None
    sharing_link: Optional[str] = None
    release_upc: Optional[str] = None
    track_isrc: Optional[str] = None
    release_title: Optional[str] = None


class PromoSubmissionCreate(BaseModel):
    """Create manual promo submission."""
    song_title: str
    outlet_name: str
    link: Optional[str] = None
    notes: Optional[str] = None


@router.get("/promo/stats")
async def get_artist_promo_stats(
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
) -> PromoStatsResponse:
    """Get promo stats for current artist."""

    result = await db.execute(
        select(PromoSubmission).where(PromoSubmission.artist_id == artist.id)
    )
    submissions = result.scalars().all()

    total_submissions = len(submissions)
    total_listens = 0
    total_approvals = 0
    total_shares = 0
    total_playlists = 0
    by_source = {}

    for sub in submissions:
        # By source
        source_key = sub.source.value if hasattr(sub.source, 'value') else str(sub.source)
        by_source[source_key] = by_source.get(source_key, 0) + 1

        # Count actions (SubmitHub)
        if sub.action:
            if sub.action == "listen":
                total_listens += 1
            elif sub.action == "approved":
                total_approvals += 1
            elif sub.action == "shared":
                total_shares += 1

        # Count decisions (Groover)
        if sub.decision:
            if "playlist" in sub.decision.lower() or "added" in sub.decision.lower():
                total_playlists += 1
            elif "approved" in sub.decision.lower() or "accepted" in sub.decision.lower():
                total_approvals += 1

    return PromoStatsResponse(
        total_submissions=total_submissions,
        total_listens=total_listens,
        total_approvals=total_approvals,
        total_shares=total_shares,
        total_playlists=total_playlists,
        by_source=by_source,
    )


@router.get("/promo/submissions")
async def get_artist_promo_submissions(
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
    source: Optional[str] = None,
    limit: int = 5000,
    offset: int = 0,
) -> List[PromoSubmissionResponse]:
    """Get promo submissions for current artist."""
    from app.models.artwork import ReleaseArtwork
    from sqlalchemy.orm import selectinload

    query = select(PromoSubmission).where(
        PromoSubmission.artist_id == artist.id
    ).options(
        selectinload(PromoSubmission.release_artwork)
    ).order_by(PromoSubmission.submitted_at.desc())

    if source:
        try:
            promo_source = PromoSource(source.lower())
            query = query.where(PromoSubmission.source == promo_source)
        except ValueError:
            pass  # Ignore invalid source filter

    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    submissions = result.scalars().all()

    return [
        PromoSubmissionResponse(
            id=str(sub.id),
            song_title=sub.song_title,
            source=sub.source.value if hasattr(sub.source, 'value') else str(sub.source),
            outlet_name=sub.outlet_name,
            outlet_type=sub.outlet_type,
            influencer_name=sub.influencer_name,
            influencer_type=sub.influencer_type,
            action=sub.action,
            decision=sub.decision,
            feedback=sub.feedback,
            listen_time=sub.listen_time,
            submitted_at=sub.submitted_at.isoformat() if sub.submitted_at else None,
            responded_at=sub.responded_at.isoformat() if sub.responded_at else None,
            campaign_url=sub.campaign_url,
            sharing_link=sub.sharing_link,
            release_upc=sub.release_upc,
            track_isrc=sub.track_isrc,
            release_title=sub.release_artwork.name if sub.release_artwork else None,
        )
        for sub in submissions
    ]


@router.post("/promo/manual")
async def create_manual_promo_submission(
    data: PromoSubmissionCreate,
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
) -> PromoSubmissionResponse:
    """Create a manual promo submission."""

    submission = PromoSubmission(
        artist_id=artist.id,
        song_title=data.song_title,
        source=PromoSource.MANUAL,
        outlet_name=data.outlet_name,
        campaign_url=data.link,
        feedback=data.notes,
        submitted_at=datetime.utcnow().date(),
    )

    db.add(submission)
    await db.commit()
    await db.refresh(submission)

    return PromoSubmissionResponse(
        id=str(submission.id),
        song_title=submission.song_title,
        source=submission.source.value if hasattr(submission.source, 'value') else str(submission.source),
        outlet_name=submission.outlet_name,
        influencer_name=submission.influencer_name,
        action=submission.action,
        decision=submission.decision,
        feedback=submission.feedback,
        submitted_at=submission.submitted_at.isoformat() if submission.submitted_at else None,
        responded_at=submission.responded_at.isoformat() if submission.responded_at else None,
        campaign_url=submission.campaign_url,
        sharing_link=submission.sharing_link,
        release_upc=submission.release_upc,
        track_isrc=submission.track_isrc,
    )


# ============ Artist Notifications ============

class ArtistNotificationResponse(BaseModel):
    """Artist notification for artist view."""
    id: str
    notification_type: str
    title: str
    message: Optional[str] = None
    link: Optional[str] = None
    data: Optional[str] = None
    is_read: bool
    created_at: str


@router.get("/notifications")
async def get_artist_notifications(
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
    unread_only: bool = False,
    limit: int = 50,
) -> List[ArtistNotificationResponse]:
    """Get notifications for current artist (specific + global admin messages)."""
    from sqlalchemy import or_

    query = select(ArtistNotification).where(
        or_(
            ArtistNotification.artist_id == artist.id,
            ArtistNotification.artist_id.is_(None)  # Global admin messages
        )
    )

    if unread_only:
        query = query.where(ArtistNotification.is_read == False)

    query = query.order_by(ArtistNotification.created_at.desc()).limit(limit)

    result = await db.execute(query)
    notifications = result.scalars().all()

    return [
        ArtistNotificationResponse(
            id=str(notif.id),
            notification_type=notif.notification_type,
            title=notif.title,
            message=notif.message,
            link=notif.link,
            data=notif.data,
            is_read=notif.is_read,
            created_at=notif.created_at.isoformat(),
        )
        for notif in notifications
    ]


@router.get("/notifications/unread-count")
async def get_unread_notifications_count(
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get count of unread notifications (specific + global)."""
    from sqlalchemy import or_

    result = await db.execute(
        select(func.count())
        .select_from(ArtistNotification)
        .where(
            or_(
                ArtistNotification.artist_id == artist.id,
                ArtistNotification.artist_id.is_(None)  # Global admin messages
            )
        )
        .where(ArtistNotification.is_read == False)
    )
    count = result.scalar()

    return {"unread_count": count or 0}


@router.put("/notifications/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str,
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark notification as read."""

    try:
        notif_uuid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid notification ID")

    result = await db.execute(
        select(ArtistNotification)
        .where(ArtistNotification.id == notif_uuid)
        .where(ArtistNotification.artist_id == artist.id)
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    await db.commit()

    return {"message": "Notification marked as read"}


@router.put("/notifications/mark-all-read")
async def mark_all_notifications_as_read(
    artist: Artist = Depends(get_current_artist),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark all notifications as read."""

    await db.execute(
        ArtistNotification.__table__.update()
        .where(ArtistNotification.artist_id == artist.id)
        .where(ArtistNotification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()

    return {"message": "All notifications marked as read"}
