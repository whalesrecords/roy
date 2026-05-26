"""
Catalog Router

Endpoints for managing track-artist links and viewing catalog data.
"""

import csv
import io
import logging
import re
from decimal import Decimal
from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import verify_admin_token
from app.core.database import get_db
from app.models.artist import Artist
from app.models.track_artist_link import TrackArtistLink
from app.models.transaction import TransactionNormalized

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/catalog", tags=["catalog"])


# --- Schemas ---

class TrackArtistLinkCreate(BaseModel):
    """Create a track-artist link."""
    artist_id: UUID
    share_percent: Decimal = Field(ge=0, le=1)


class TrackArtistLinkResponse(BaseModel):
    """Response for a track-artist link."""
    id: UUID
    isrc: str
    artist_id: UUID
    artist_name: str
    share_percent: str
    track_title: Optional[str] = None
    release_title: Optional[str] = None


class CatalogTrackResponse(BaseModel):
    """Response for a catalog track with links."""
    isrc: str
    track_title: str
    release_title: str
    upc: Optional[str] = None
    total_gross: str
    total_streams: int
    original_artist_name: str
    linked_artists: List[TrackArtistLinkResponse]
    is_linked: bool


class CollaborationSuggestion(BaseModel):
    """Suggestion for a collaboration split."""
    isrc: str
    track_title: str
    original_artist_name: str
    detected_artists: List[dict]
    suggested_equal_split: str


# --- Endpoints ---

@router.get("/tracks", response_model=List[CatalogTrackResponse])
async def list_catalog_tracks(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    search: Optional[str] = Query(None, description="Search by track title or artist name"),
    has_links: Optional[bool] = Query(None, description="Filter by linked status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> List[CatalogTrackResponse]:
    """
    List all unique tracks from transactions with their current artist links.
    """
    # Get unique tracks from transactions
    tracks_query = (
        select(
            TransactionNormalized.isrc,
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
            TransactionNormalized.upc,
            TransactionNormalized.artist_name,
            func.sum(TransactionNormalized.gross_amount).label("total_gross"),
            func.sum(TransactionNormalized.quantity).label("total_streams"),
        )
        .where(TransactionNormalized.isrc.isnot(None))
        .group_by(
            TransactionNormalized.isrc,
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
            TransactionNormalized.upc,
            TransactionNormalized.artist_name,
        )
    )

    if search:
        search_filter = f"%{search}%"
        tracks_query = tracks_query.where(
            (TransactionNormalized.track_title.ilike(search_filter)) |
            (TransactionNormalized.artist_name.ilike(search_filter))
        )

    tracks_query = tracks_query.order_by(func.sum(TransactionNormalized.gross_amount).desc())
    tracks_query = tracks_query.offset(offset).limit(limit)

    result = await db.execute(tracks_query)
    tracks = result.all()

    # Get all links for these ISRCs
    isrcs = [t.isrc for t in tracks if t.isrc]
    links_query = (
        select(TrackArtistLink)
        .options(selectinload(TrackArtistLink.artist))
        .where(TrackArtistLink.isrc.in_(isrcs))
    )
    links_result = await db.execute(links_query)
    links = links_result.scalars().all()

    # Index links by ISRC
    links_by_isrc: dict = {}
    for link in links:
        if link.isrc not in links_by_isrc:
            links_by_isrc[link.isrc] = []
        links_by_isrc[link.isrc].append(link)

    # Build response
    response = []
    for track in tracks:
        track_links = links_by_isrc.get(track.isrc, [])
        is_linked = len(track_links) > 0

        # Filter by has_links if specified
        if has_links is not None and is_linked != has_links:
            continue

        response.append(CatalogTrackResponse(
            isrc=track.isrc,
            track_title=track.track_title or "",
            release_title=track.release_title or "",
            upc=track.upc,
            total_gross=str(track.total_gross or 0),
            total_streams=track.total_streams or 0,
            original_artist_name=track.artist_name or "",
            linked_artists=[
                TrackArtistLinkResponse(
                    id=link.id,
                    isrc=link.isrc,
                    artist_id=link.artist_id,
                    artist_name=link.artist.name if link.artist else "",
                    share_percent=str(link.share_percent),
                    track_title=link.track_title,
                    release_title=link.release_title,
                )
                for link in track_links
            ],
            is_linked=is_linked,
        ))

    return response


@router.get("/export.csv")
async def export_catalog_csv(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> StreamingResponse:
    """
    Export the full catalog as CSV.
    Columns: ISRC, Track Title, Release Title, UPC, Original Artist,
             Linked Artists, Shares (%), Total Streams, Total Gross (EUR)
    One row per ISRC; artists/shares are joined with ' | ' when multiple.
    """
    # Fetch all unique tracks (no pagination)
    tracks_query = (
        select(
            TransactionNormalized.isrc,
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
            TransactionNormalized.upc,
            TransactionNormalized.artist_name,
            func.sum(TransactionNormalized.gross_amount).label("total_gross"),
            func.sum(TransactionNormalized.quantity).label("total_streams"),
        )
        .where(TransactionNormalized.isrc.isnot(None))
        .group_by(
            TransactionNormalized.isrc,
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
            TransactionNormalized.upc,
            TransactionNormalized.artist_name,
        )
        .order_by(func.sum(TransactionNormalized.gross_amount).desc())
    )
    result = await db.execute(tracks_query)
    tracks = result.all()

    # Fetch all artist links for these ISRCs in one query
    isrcs = [t.isrc for t in tracks if t.isrc]
    links_result = await db.execute(
        select(TrackArtistLink)
        .options(selectinload(TrackArtistLink.artist))
        .where(TrackArtistLink.isrc.in_(isrcs))
    )
    links_by_isrc: dict[str, list] = {}
    for link in links_result.scalars().all():
        links_by_isrc.setdefault(link.isrc, []).append(link)

    # Build CSV in memory
    output = io.StringIO()
    writer = csv.writer(output, dialect="excel")
    writer.writerow([
        "ISRC", "Track Title", "Release Title", "UPC",
        "Original Artist", "Linked Artists", "Shares (%)",
        "Total Streams", "Total Gross (EUR)",
    ])
    for track in tracks:
        track_links = links_by_isrc.get(track.isrc, [])
        linked_names = " | ".join(
            link.artist.name if link.artist else "" for link in track_links
        )
        linked_shares = " | ".join(
            str(round(float(link.share_percent) * 100, 2)) for link in track_links
        )
        writer.writerow([
            track.isrc or "",
            track.track_title or "",
            track.release_title or "",
            track.upc or "",
            track.artist_name or "",
            linked_names,
            linked_shares,
            track.total_streams or 0,
            str(round(float(track.total_gross or 0), 2)),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=catalogue-whales.csv"},
    )


@router.get("/tracks/{isrc}", response_model=CatalogTrackResponse)
async def get_track_details(
    isrc: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> CatalogTrackResponse:
    """Get details for a specific track by ISRC."""
    # Get track data from transactions
    track_query = (
        select(
            TransactionNormalized.isrc,
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
            TransactionNormalized.upc,
            TransactionNormalized.artist_name,
            func.sum(TransactionNormalized.gross_amount).label("total_gross"),
            func.sum(TransactionNormalized.quantity).label("total_streams"),
        )
        .where(TransactionNormalized.isrc == isrc)
        .group_by(
            TransactionNormalized.isrc,
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
            TransactionNormalized.upc,
            TransactionNormalized.artist_name,
        )
    )

    result = await db.execute(track_query)
    track = result.first()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Get links for this ISRC
    links_query = (
        select(TrackArtistLink)
        .options(selectinload(TrackArtistLink.artist))
        .where(TrackArtistLink.isrc == isrc)
    )
    links_result = await db.execute(links_query)
    links = links_result.scalars().all()

    return CatalogTrackResponse(
        isrc=track.isrc,
        track_title=track.track_title or "",
        release_title=track.release_title or "",
        upc=track.upc,
        total_gross=str(track.total_gross or 0),
        total_streams=track.total_streams or 0,
        original_artist_name=track.artist_name or "",
        linked_artists=[
            TrackArtistLinkResponse(
                id=link.id,
                isrc=link.isrc,
                artist_id=link.artist_id,
                artist_name=link.artist.name if link.artist else "",
                share_percent=str(link.share_percent),
                track_title=link.track_title,
                release_title=link.release_title,
            )
            for link in links
        ],
        is_linked=len(links) > 0,
    )


@router.post("/tracks/{isrc}/artists", response_model=List[TrackArtistLinkResponse])
async def link_artists_to_track(
    isrc: str,
    links: List[TrackArtistLinkCreate],
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> List[TrackArtistLinkResponse]:
    """
    Create artist links for a track. Replaces all existing links.
    Validates that share percentages sum to 1.0.
    """
    # Validate shares sum to 1.0
    total_share = sum(link.share_percent for link in links)
    if abs(total_share - Decimal("1.0")) > Decimal("0.0001"):
        raise HTTPException(
            status_code=400,
            detail=f"Share percentages must sum to 1.0, got {total_share}"
        )

    # Validate all artists exist
    artist_ids = [link.artist_id for link in links]
    artists_query = select(Artist).where(Artist.id.in_(artist_ids))
    artists_result = await db.execute(artists_query)
    artists = {a.id: a for a in artists_result.scalars().all()}

    if len(artists) != len(artist_ids):
        missing = set(artist_ids) - set(artists.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Artists not found: {missing}"
        )

    # Get track info for denormalization
    track_query = (
        select(TransactionNormalized)
        .where(TransactionNormalized.isrc == isrc)
        .limit(1)
    )
    track_result = await db.execute(track_query)
    track = track_result.scalar_one_or_none()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found in catalog")

    # Delete existing links
    existing_query = select(TrackArtistLink).where(TrackArtistLink.isrc == isrc)
    existing_result = await db.execute(existing_query)
    for existing in existing_result.scalars().all():
        await db.delete(existing)
    await db.flush()  # Flush deletions before creating new links

    # Create new links
    new_links = []
    for link_data in links:
        new_link = TrackArtistLink(
            isrc=isrc,
            artist_id=link_data.artist_id,
            share_percent=link_data.share_percent,
            track_title=track.track_title,
            release_title=track.release_title,
            upc=track.upc,
        )
        db.add(new_link)
        new_links.append(new_link)

    await db.flush()

    return [
        TrackArtistLinkResponse(
            id=link.id,
            isrc=link.isrc,
            artist_id=link.artist_id,
            artist_name=artists[link.artist_id].name,
            share_percent=str(link.share_percent),
            track_title=link.track_title,
            release_title=link.release_title,
        )
        for link in new_links
    ]


@router.delete("/tracks/{isrc}/artists/{artist_id}")
async def unlink_artist_from_track(
    isrc: str,
    artist_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """Remove a specific artist from a track."""
    link_query = select(TrackArtistLink).where(
        and_(
            TrackArtistLink.isrc == isrc,
            TrackArtistLink.artist_id == artist_id,
        )
    )
    result = await db.execute(link_query)
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    await db.delete(link)
    await db.flush()

    return {"success": True, "message": f"Unlinked artist {artist_id} from track {isrc}"}


@router.get("/tracks/suggestions/collaborations", response_model=List[CollaborationSuggestion])
async def get_collaboration_suggestions(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    limit: int = Query(50, ge=1, le=200),
) -> List[CollaborationSuggestion]:
    """
    Detect collaborative artist names and suggest splits.
    Looks for patterns like "Artist A & Artist B".
    """
    # Get existing artists for matching
    artists_query = select(Artist)
    artists_result = await db.execute(artists_query)
    existing_artists = {a.name.lower(): a for a in artists_result.scalars().all()}

    # Get tracks that aren't already linked
    linked_isrcs_query = select(distinct(TrackArtistLink.isrc))
    linked_result = await db.execute(linked_isrcs_query)
    linked_isrcs = {r[0] for r in linked_result.all()}

    # Get unique artist names from transactions
    tracks_query = (
        select(
            TransactionNormalized.isrc,
            TransactionNormalized.track_title,
            TransactionNormalized.artist_name,
        )
        .where(TransactionNormalized.isrc.isnot(None))
        .distinct()
    )
    result = await db.execute(tracks_query)
    tracks = result.all()

    suggestions = []
    collab_patterns = [
        r'\s+feat\.?\s+',
        r'\s+ft\.?\s+',
        r'\s+featuring\s+',
        r'\s+&\s+',
        r'\s+[xX]\s+',
        r'\s+vs\.?\s+',
        r',\s*',  # Comma-separated artists (e.g., "Lissom, Julien Marchal, Lowswimmer")
    ]

    for track in tracks:
        if not track.artist_name or track.isrc in linked_isrcs:
            continue

        # Check if it's a collaboration
        is_collab = False
        for pattern in collab_patterns:
            if re.search(pattern, track.artist_name, re.IGNORECASE):
                is_collab = True
                break

        if not is_collab:
            continue

        # Split the artist name
        detected_names = []
        remaining = track.artist_name
        for pattern in collab_patterns:
            parts = re.split(pattern, remaining, flags=re.IGNORECASE)
            if len(parts) > 1:
                detected_names = [p.strip() for p in parts if p.strip()]
                break

        if len(detected_names) < 2:
            continue

        # Match to existing artists
        detected_artists = []
        for name in detected_names:
            name_lower = name.lower()
            matched_artist = existing_artists.get(name_lower)
            detected_artists.append({
                "name": name,
                "exists": matched_artist is not None,
                "artist_id": str(matched_artist.id) if matched_artist else None,
                "artist_name": matched_artist.name if matched_artist else name,
            })

        # Only suggest if at least one artist exists
        if any(d["exists"] for d in detected_artists):
            equal_split = str(round(Decimal("1.0") / len(detected_artists), 4))
            suggestions.append(CollaborationSuggestion(
                isrc=track.isrc,
                track_title=track.track_title or "",
                original_artist_name=track.artist_name,
                detected_artists=detected_artists,
                suggested_equal_split=equal_split,
            ))

        if len(suggestions) >= limit:
            break

    return suggestions


# ===========================================================================
# Manual Releases & Tracks — CRUD
# ===========================================================================

from datetime import date as _date
from app.models.manual_release import ManualRelease
from app.models.manual_track import ManualTrack


class ManualTrackCreate(BaseModel):
    title: str
    isrc: Optional[str] = None
    position: Optional[int] = None
    duration_seconds: Optional[int] = None


class ManualTrackUpdate(BaseModel):
    title: Optional[str] = None
    isrc: Optional[str] = None
    position: Optional[int] = None
    duration_seconds: Optional[int] = None


class ManualTrackResponse(BaseModel):
    id: UUID
    title: str
    isrc: Optional[str] = None
    position: Optional[int] = None
    duration_seconds: Optional[int] = None
    release_id: Optional[UUID] = None


class ManualReleaseCreate(BaseModel):
    title: str
    upc: Optional[str] = None
    artist_id: Optional[UUID] = None
    artist_name_override: Optional[str] = None
    release_date: Optional[_date] = None
    format: Optional[str] = None  # album | ep | single | compilation
    notes: Optional[str] = None
    cover_url: Optional[str] = None
    tracks: Optional[List[ManualTrackCreate]] = None


class ManualReleaseUpdate(BaseModel):
    title: Optional[str] = None
    upc: Optional[str] = None
    artist_id: Optional[UUID] = None
    artist_name_override: Optional[str] = None
    release_date: Optional[_date] = None
    format: Optional[str] = None
    notes: Optional[str] = None
    cover_url: Optional[str] = None


class ManualReleaseResponse(BaseModel):
    id: UUID
    title: str
    upc: Optional[str] = None
    artist_id: Optional[UUID] = None
    artist_name: Optional[str] = None
    release_date: Optional[_date] = None
    format: Optional[str] = None
    notes: Optional[str] = None
    cover_url: Optional[str] = None
    tracks: List[ManualTrackResponse] = []
    created_at: str
    updated_at: str


def _release_response(r: ManualRelease) -> ManualReleaseResponse:
    artist_name = None
    if r.artist:
        artist_name = r.artist.name
    elif r.artist_name_override:
        artist_name = r.artist_name_override
    return ManualReleaseResponse(
        id=r.id,
        title=r.title,
        upc=r.upc,
        artist_id=r.artist_id,
        artist_name=artist_name,
        release_date=r.release_date,
        format=r.format,
        notes=r.notes,
        cover_url=r.cover_url,
        tracks=[
            ManualTrackResponse(
                id=t.id,
                title=t.title,
                isrc=t.isrc,
                position=t.position,
                duration_seconds=t.duration_seconds,
                release_id=t.release_id,
            )
            for t in (r.tracks or [])
        ],
        created_at=r.created_at.isoformat(),
        updated_at=r.updated_at.isoformat(),
    )


# --- List ---

@router.get("/releases", response_model=List[ManualReleaseResponse])
async def list_manual_releases(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    artist_id: Optional[UUID] = None,
    search: Optional[str] = Query(None),
) -> List[ManualReleaseResponse]:
    """List all manually-registered releases."""
    q = select(ManualRelease).options(
        selectinload(ManualRelease.artist),
        selectinload(ManualRelease.tracks),
    )
    if artist_id:
        q = q.where(ManualRelease.artist_id == artist_id)
    if search:
        q = q.where(ManualRelease.title.ilike(f"%{search}%"))
    q = q.order_by(ManualRelease.title)
    result = await db.execute(q)
    return [_release_response(r) for r in result.scalars().all()]


# --- Create ---

@router.post("/releases", response_model=ManualReleaseResponse, status_code=201)
async def create_manual_release(
    payload: ManualReleaseCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ManualReleaseResponse:
    """Create a new manual release, optionally with tracks."""
    # Normalise UPC — strip whitespace, store None if empty
    upc = (payload.upc or "").strip() or None
    if upc:
        existing = await db.execute(select(ManualRelease).where(ManualRelease.upc == upc))
        if existing.scalars().first():
            raise HTTPException(status_code=409, detail=f"Un album avec l'UPC {upc} existe déjà.")

    release = ManualRelease(
        title=payload.title.strip(),
        upc=upc,
        artist_id=payload.artist_id,
        artist_name_override=(payload.artist_name_override or "").strip() or None,
        release_date=payload.release_date,
        format=payload.format,
        notes=payload.notes,
        cover_url=payload.cover_url,
    )
    db.add(release)
    await db.flush()

    if payload.tracks:
        for i, t in enumerate(payload.tracks):
            isrc = (t.isrc or "").strip().upper() or None
            track = ManualTrack(
                title=t.title.strip(),
                isrc=isrc,
                release_id=release.id,
                position=t.position if t.position is not None else (i + 1),
                duration_seconds=t.duration_seconds,
            )
            db.add(track)

    await db.flush()
    await db.refresh(release)
    # Re-fetch with relationships loaded
    result = await db.execute(
        select(ManualRelease)
        .options(selectinload(ManualRelease.artist), selectinload(ManualRelease.tracks))
        .where(ManualRelease.id == release.id)
    )
    return _release_response(result.scalars().one())


# --- Get one ---

@router.get("/releases/{release_id}", response_model=ManualReleaseResponse)
async def get_manual_release(
    release_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ManualReleaseResponse:
    result = await db.execute(
        select(ManualRelease)
        .options(selectinload(ManualRelease.artist), selectinload(ManualRelease.tracks))
        .where(ManualRelease.id == release_id)
    )
    release = result.scalars().first()
    if not release:
        raise HTTPException(status_code=404, detail="Album introuvable")
    return _release_response(release)


# --- Update ---

@router.put("/releases/{release_id}", response_model=ManualReleaseResponse)
async def update_manual_release(
    release_id: UUID,
    payload: ManualReleaseUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ManualReleaseResponse:
    result = await db.execute(
        select(ManualRelease)
        .options(selectinload(ManualRelease.artist), selectinload(ManualRelease.tracks))
        .where(ManualRelease.id == release_id)
    )
    release = result.scalars().first()
    if not release:
        raise HTTPException(status_code=404, detail="Album introuvable")

    if payload.title is not None:
        release.title = payload.title.strip()
    if payload.upc is not None:
        upc = payload.upc.strip() or None
        if upc and upc != release.upc:
            clash = await db.execute(select(ManualRelease).where(ManualRelease.upc == upc))
            if clash.scalars().first():
                raise HTTPException(status_code=409, detail=f"UPC {upc} déjà utilisé.")
        release.upc = upc
    if payload.artist_id is not None:
        release.artist_id = payload.artist_id
    if payload.artist_name_override is not None:
        release.artist_name_override = payload.artist_name_override.strip() or None
    if payload.release_date is not None:
        release.release_date = payload.release_date
    if payload.format is not None:
        release.format = payload.format
    if payload.notes is not None:
        release.notes = payload.notes
    if payload.cover_url is not None:
        release.cover_url = payload.cover_url

    await db.flush()
    result2 = await db.execute(
        select(ManualRelease)
        .options(selectinload(ManualRelease.artist), selectinload(ManualRelease.tracks))
        .where(ManualRelease.id == release_id)
    )
    return _release_response(result2.scalars().one())


# --- Delete ---

@router.delete("/releases/{release_id}", status_code=204)
async def delete_manual_release(
    release_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> None:
    result = await db.execute(select(ManualRelease).where(ManualRelease.id == release_id))
    release = result.scalars().first()
    if not release:
        raise HTTPException(status_code=404, detail="Album introuvable")
    await db.delete(release)


# --- Track sub-resources ---

@router.post("/releases/{release_id}/tracks", response_model=ManualTrackResponse, status_code=201)
async def add_track_to_release(
    release_id: UUID,
    payload: ManualTrackCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ManualTrackResponse:
    # Verify release exists
    res = await db.execute(select(ManualRelease).where(ManualRelease.id == release_id))
    if not res.scalars().first():
        raise HTTPException(status_code=404, detail="Album introuvable")

    isrc = (payload.isrc or "").strip().upper() or None
    if isrc:
        clash = await db.execute(select(ManualTrack).where(ManualTrack.isrc == isrc))
        if clash.scalars().first():
            raise HTTPException(status_code=409, detail=f"ISRC {isrc} déjà enregistré.")

    track = ManualTrack(
        title=payload.title.strip(),
        isrc=isrc,
        release_id=release_id,
        position=payload.position,
        duration_seconds=payload.duration_seconds,
    )
    db.add(track)
    await db.flush()
    return ManualTrackResponse(
        id=track.id,
        title=track.title,
        isrc=track.isrc,
        position=track.position,
        duration_seconds=track.duration_seconds,
        release_id=track.release_id,
    )


@router.put("/releases/{release_id}/tracks/{track_id}", response_model=ManualTrackResponse)
async def update_track(
    release_id: UUID,
    track_id: UUID,
    payload: ManualTrackUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ManualTrackResponse:
    result = await db.execute(
        select(ManualTrack).where(
            ManualTrack.id == track_id,
            ManualTrack.release_id == release_id,
        )
    )
    track = result.scalars().first()
    if not track:
        raise HTTPException(status_code=404, detail="Titre introuvable")

    if payload.title is not None:
        track.title = payload.title.strip()
    if payload.isrc is not None:
        isrc = payload.isrc.strip().upper() or None
        if isrc and isrc != track.isrc:
            clash = await db.execute(select(ManualTrack).where(ManualTrack.isrc == isrc))
            if clash.scalars().first():
                raise HTTPException(status_code=409, detail=f"ISRC {isrc} déjà enregistré.")
        track.isrc = isrc
    if payload.position is not None:
        track.position = payload.position
    if payload.duration_seconds is not None:
        track.duration_seconds = payload.duration_seconds

    await db.flush()
    return ManualTrackResponse(
        id=track.id,
        title=track.title,
        isrc=track.isrc,
        position=track.position,
        duration_seconds=track.duration_seconds,
        release_id=track.release_id,
    )


@router.delete("/releases/{release_id}/tracks/{track_id}", status_code=204)
async def delete_track(
    release_id: UUID,
    track_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> None:
    result = await db.execute(
        select(ManualTrack).where(
            ManualTrack.id == track_id,
            ManualTrack.release_id == release_id,
        )
    )
    track = result.scalars().first()
    if not track:
        raise HTTPException(status_code=404, detail="Titre introuvable")
    await db.delete(track)
