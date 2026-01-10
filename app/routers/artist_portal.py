"""Artist Portal API endpoints for artists to view their royalties."""
import secrets
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.artist import Artist
from app.models.transaction import TransactionNormalized
from app.models.advance_ledger import AdvanceLedgerEntry
from app.models.contract import Contract

router = APIRouter(prefix="/artist-portal", tags=["Artist Portal"])


# ============ Schemas ============

class LoginRequest(BaseModel):
    code: str


class LoginResponse(BaseModel):
    token: str
    artist: dict


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


# ============ Token Storage (simple in-memory for MVP) ============
# In production, use Redis or database storage

_tokens: dict[str, str] = {}  # token -> artist_id


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def store_token(token: str, artist_id: str):
    _tokens[token] = artist_id


def get_artist_id_from_token(token: str) -> Optional[str]:
    return _tokens.get(token)


async def get_current_artist(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
) -> Artist:
    """Get the current artist from the authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non authentifié")

    token = authorization.replace("Bearer ", "")
    artist_id = get_artist_id_from_token(token)

    if not artist_id:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")

    result = await db.execute(select(Artist).where(Artist.id == uuid.UUID(artist_id)))
    artist = result.scalar_one_or_none()

    if not artist:
        raise HTTPException(status_code=404, detail="Artiste non trouvé")

    return artist


# ============ Endpoints ============

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with access code."""
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
            func.coalesce(func.sum(TransactionNormalized.gross_eur), 0).label("gross"),
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

    # Get artist share from contracts (average)
    contracts_result = await db.execute(
        select(Contract).where(Contract.artist_id == artist.id)
    )
    contracts = contracts_result.scalars().all()

    artist_share = 0.5  # Default 50%
    if contracts:
        # Use the first contract's share as default
        for c in contracts:
            if c.parties:
                for party in c.parties:
                    if party.party_type == "artist":
                        artist_share = party.share_percent / 100
                        break
                break

    # Calculate net (gross * artist_share - advances + payments)
    total_net = (total_gross * artist_share) - advance_balance + payments_total

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
    result = await db.execute(
        select(
            TransactionNormalized.upc,
            TransactionNormalized.release_title,
            func.sum(TransactionNormalized.gross_eur).label("gross"),
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
        .order_by(func.sum(TransactionNormalized.gross_eur).desc())
    )

    releases = []
    for row in result.all():
        gross = float(row.gross or 0)
        net = gross * 0.5  # Default 50% share
        releases.append({
            "upc": row.upc,
            "title": row.release_title or "Unknown",
            "artwork_url": None,
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
    result = await db.execute(
        select(
            TransactionNormalized.isrc,
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
            func.sum(TransactionNormalized.gross_eur).label("gross"),
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
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
        )
        .order_by(func.sum(TransactionNormalized.gross_eur).desc())
    )

    tracks = []
    for row in result.all():
        gross = float(row.gross or 0)
        net = gross * 0.5  # Default 50% share
        tracks.append({
            "isrc": row.isrc,
            "title": row.track_title or "Unknown",
            "release_title": row.release_title,
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
            "amount": entry.amount,
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
        TransactionNormalized.source,
        func.sum(TransactionNormalized.gross_eur).label("gross"),
        func.sum(TransactionNormalized.quantity).label("streams"),
    ).where(TransactionNormalized.artist_name == artist.name)

    if year:
        query = query.where(
            func.extract("year", TransactionNormalized.sale_month) == year
        )

    query = query.group_by(TransactionNormalized.source).order_by(
        func.sum(TransactionNormalized.gross_eur).desc()
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
        source = row.source or "other"
        stats.append({
            "platform": source.lower().replace(" ", "_"),
            "platform_label": platform_labels.get(source.lower().replace(" ", "_"), source),
            "gross": f"{gross:.2f}",
            "streams": int(row.streams or 0),
            "percentage": percentage,
        })

    return stats


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
    artist.access_code = code

    await db.commit()

    return {"access_code": code}
