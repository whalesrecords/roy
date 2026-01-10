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
from app.models.advance_ledger import AdvanceLedgerEntry, LedgerEntryType, ExpenseCategory
from app.models.contract import Contract
from app.models.artwork import ReleaseArtwork, TrackArtwork
from app.models.contract_party import ContractParty
from app.models.label_settings import LabelSettings
from app.models.statement import Statement
from app.models.royalty_line_item import RoyaltyLineItem

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
    label_logo_url: Optional[str] = None


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

    releases = []
    for row in rows:
        gross = float(row.gross or 0)
        net = gross * 0.5  # Default 50% share
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
    result = await db.execute(
        select(
            TransactionNormalized.isrc,
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

    tracks = []
    for row in rows:
        gross = float(row.gross or 0)
        net = gross * 0.5  # Default 50% share
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
        return {"label_name": None, "label_logo_url": None}

    return {
        "label_name": settings.label_name,
        "label_logo_url": settings.logo_base64 or settings.logo_url,
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
    artist.access_code = code

    await db.commit()

    return {"access_code": code}
