"""
Artists Router

Handles artist management, contracts, and advances.
"""

import logging
from decimal import Decimal
from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.artist import Artist
from app.models.contract import Contract, ContractScope
from app.models.advance_ledger import AdvanceLedgerEntry, LedgerEntryType
from pydantic import BaseModel as PydanticBaseModel
from app.schemas.royalties import (
    ArtistCreate,
    ArtistResponse,
    ContractCreate,
    ContractResponse,
    AdvanceCreate,
    AdvanceLedgerEntryResponse,
    AdvanceBalanceResponse,
    PaymentCreate,
)
from app.models.transaction import TransactionNormalized

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/artists", tags=["artists"])


async def verify_admin_token(x_admin_token: Annotated[str, Header()]) -> str:
    """Verify the admin token from header."""
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )
    return x_admin_token


# Artist endpoints

@router.post("", response_model=ArtistResponse)
async def create_artist(
    data: ArtistCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ArtistResponse:
    """Create a new artist."""
    # Check for duplicate name
    result = await db.execute(
        select(Artist).where(Artist.name == data.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Artist with name '{data.name}' already exists",
        )

    artist = Artist(
        name=data.name,
        external_id=data.external_id,
    )
    db.add(artist)
    await db.flush()

    return ArtistResponse(
        id=artist.id,
        name=artist.name,
        category=artist.category or "signed",
        external_id=artist.external_id,
        spotify_id=artist.spotify_id,
        image_url=artist.image_url,
        image_url_small=artist.image_url_small,
        created_at=artist.created_at,
    )


@router.get("", response_model=List[ArtistResponse])
async def list_artists(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> List[ArtistResponse]:
    """List all artists."""
    result = await db.execute(
        select(Artist).order_by(Artist.name)
    )
    artists = result.scalars().all()

    return [
        ArtistResponse(
            id=artist.id,
            name=artist.name,
            category=artist.category or "signed",
            external_id=artist.external_id,
            spotify_id=artist.spotify_id,
            image_url=artist.image_url,
            image_url_small=artist.image_url_small,
            created_at=artist.created_at,
        )
        for artist in artists
    ]


class SimilarArtistGroup(PydanticBaseModel):
    """Group of similar artists (same name, different case)."""
    canonical_name: str
    artists: List[ArtistResponse]


@router.get("/duplicates", response_model=List[SimilarArtistGroup])
async def find_duplicate_artists(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> List[SimilarArtistGroup]:
    """
    Find artists with similar names (same name, different capitalization).
    Returns groups of artists that might be duplicates.
    """
    result = await db.execute(select(Artist).order_by(Artist.name))
    artists = result.scalars().all()

    # Group by lowercase name
    groups: dict[str, list] = {}
    for artist in artists:
        key = artist.name.lower().strip()
        if key not in groups:
            groups[key] = []
        groups[key].append(artist)

    # Return only groups with more than 1 artist
    duplicates = []
    for canonical, artist_list in groups.items():
        if len(artist_list) > 1:
            duplicates.append(SimilarArtistGroup(
                canonical_name=canonical,
                artists=[
                    ArtistResponse(
                        id=a.id,
                        name=a.name,
                        category=a.category or "signed",
                        external_id=a.external_id,
                        spotify_id=a.spotify_id,
                        image_url=a.image_url,
                        image_url_small=a.image_url_small,
                        created_at=a.created_at,
                    )
                    for a in artist_list
                ]
            ))

    return duplicates


@router.post("/merge")
async def merge_artists(
    source_id: UUID,
    target_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Merge source artist into target artist.
    - Transfers all track-artist links from source to target
    - Transfers all advances from source to target
    - Transfers all contracts from source to target
    - Updates all transactions artist_name to target name
    - Deletes the source artist
    """
    from app.models.track_artist_link import TrackArtistLink

    # Get both artists
    source_result = await db.execute(select(Artist).where(Artist.id == source_id))
    source = source_result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail=f"Source artist {source_id} not found")

    target_result = await db.execute(select(Artist).where(Artist.id == target_id))
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail=f"Target artist {target_id} not found")

    # Transfer track-artist links
    links_result = await db.execute(
        select(TrackArtistLink).where(TrackArtistLink.artist_id == source_id)
    )
    links = links_result.scalars().all()
    for link in links:
        # Check if target already has this link
        existing = await db.execute(
            select(TrackArtistLink).where(
                TrackArtistLink.artist_id == target_id,
                TrackArtistLink.isrc == link.isrc
            )
        )
        if not existing.scalar_one_or_none():
            link.artist_id = target_id
        else:
            await db.delete(link)

    # Transfer advances
    advances_result = await db.execute(
        select(AdvanceLedgerEntry).where(AdvanceLedgerEntry.artist_id == source_id)
    )
    advances = advances_result.scalars().all()
    for advance in advances:
        advance.artist_id = target_id

    # Transfer contracts
    contracts_result = await db.execute(
        select(Contract).where(Contract.artist_id == source_id)
    )
    contracts = contracts_result.scalars().all()
    for contract in contracts:
        contract.artist_id = target_id

    # Update transactions with source artist name to use target name
    await db.execute(
        text("""
            UPDATE transactions_normalized
            SET artist_name = :target_name
            WHERE LOWER(artist_name) = LOWER(:source_name)
        """),
        {"target_name": target.name, "source_name": source.name}
    )

    # Delete source artist
    source_name = source.name
    await db.delete(source)
    await db.flush()

    return {
        "success": True,
        "message": f"Merged '{source_name}' into '{target.name}'",
        "source_id": str(source_id),
        "target_id": str(target_id),
        "links_transferred": len(links),
        "advances_transferred": len(advances),
        "contracts_transferred": len(contracts),
    }


@router.get("/summary", response_model=List[dict])
async def list_artists_with_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> List[dict]:
    """
    List all artists with aggregated revenue including collaborations.
    Revenue includes direct transactions + collaboration shares via track-artist links.
    """
    from sqlalchemy import or_
    from app.models.track_artist_link import TrackArtistLink

    # Get all artists
    result = await db.execute(select(Artist).order_by(Artist.name))
    artists = result.scalars().all()

    summary = []
    for artist in artists:
        # Get track-artist links for this artist
        links_result = await db.execute(
            select(TrackArtistLink).where(TrackArtistLink.artist_id == artist.id)
        )
        artist_links = links_result.scalars().all()
        linked_isrcs = {link.isrc for link in artist_links}
        link_shares = {link.isrc: link.share_percent for link in artist_links}

        # Build query for transactions
        if linked_isrcs:
            where_clause = or_(
                TransactionNormalized.artist_name == artist.name,
                TransactionNormalized.isrc.in_(linked_isrcs),
            )
        else:
            where_clause = TransactionNormalized.artist_name == artist.name

        # Get aggregated data
        tx_result = await db.execute(
            select(
                func.sum(TransactionNormalized.gross_amount).label("total_gross"),
                func.sum(TransactionNormalized.quantity).label("total_streams"),
                func.count().label("transaction_count"),
            ).where(where_clause)
        )
        row = tx_result.first()

        # Calculate collaboration-adjusted gross
        total_gross = Decimal("0")
        if row and row.total_gross:
            # Get detailed transactions to apply shares correctly
            detail_result = await db.execute(
                select(
                    TransactionNormalized.artist_name,
                    TransactionNormalized.isrc,
                    TransactionNormalized.gross_amount,
                ).where(where_clause)
            )
            for tx in detail_result.all():
                if tx.artist_name == artist.name:
                    total_gross += tx.gross_amount or Decimal("0")
                elif tx.isrc and tx.isrc in link_shares:
                    total_gross += (tx.gross_amount or Decimal("0")) * link_shares[tx.isrc]

        summary.append({
            "id": str(artist.id),
            "name": artist.name,
            "external_id": artist.external_id,
            "spotify_id": artist.spotify_id,
            "image_url": artist.image_url,
            "image_url_small": artist.image_url_small,
            "created_at": artist.created_at.isoformat() if artist.created_at else None,
            "total_gross": str(total_gross),
            "total_streams": row.total_streams if row else 0,
            "transaction_count": row.transaction_count if row else 0,
            "has_collaborations": len(linked_isrcs) > 0,
        })

    # Sort by total_gross descending
    summary.sort(key=lambda x: Decimal(x["total_gross"]), reverse=True)
    return summary


@router.get("/{artist_id}", response_model=ArtistResponse)
async def get_artist(
    artist_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ArtistResponse:
    """Get an artist by ID."""
    result = await db.execute(
        select(Artist).where(Artist.id == artist_id)
    )
    artist = result.scalar_one_or_none()

    if artist is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    return ArtistResponse(
        id=artist.id,
        name=artist.name,
        category=artist.category or "signed",
        external_id=artist.external_id,
        spotify_id=artist.spotify_id,
        image_url=artist.image_url,
        image_url_small=artist.image_url_small,
        created_at=artist.created_at,
    )


class MergeRequest(PydanticBaseModel):
    source_ids: List[UUID]


@router.post("/{target_id}/merge")
async def merge_artists(
    target_id: UUID,
    data: MergeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Merge multiple artists into one target artist.

    All contracts, advances, and transactions from source artists
    will be transferred to the target artist. Source artists will be deleted.

    Args:
        target_id: ID of the artist to keep
        source_ids: List of artist IDs to merge into target
    """
    from sqlalchemy import update

    # Verify target exists
    result = await db.execute(select(Artist).where(Artist.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target artist {target_id} not found",
        )

    # Verify all source artists exist
    for source_id in data.source_ids:
        if source_id == target_id:
            continue
        result = await db.execute(select(Artist).where(Artist.id == source_id))
        source = result.scalar_one_or_none()
        if not source:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source artist {source_id} not found",
            )

    merged_count = 0
    for source_id in data.source_ids:
        if source_id == target_id:
            continue

        # Get source artist
        result = await db.execute(select(Artist).where(Artist.id == source_id))
        source = result.scalar_one_or_none()
        if not source:
            continue

        # Update contracts to point to target
        await db.execute(
            update(Contract)
            .where(Contract.artist_id == source_id)
            .values(artist_id=target_id)
        )

        # Update advances to point to target
        await db.execute(
            update(AdvanceLedgerEntry)
            .where(AdvanceLedgerEntry.artist_id == source_id)
            .values(artist_id=target_id)
        )

        # Update transactions to use target artist name
        await db.execute(
            update(TransactionNormalized)
            .where(TransactionNormalized.artist_name == source.name)
            .values(artist_name=target.name)
        )

        # Delete source artist
        await db.delete(source)
        merged_count += 1

    await db.flush()

    return {
        "success": True,
        "target_id": str(target_id),
        "merged_count": merged_count,
        "message": f"Merged {merged_count} artist(s) into {target.name}"
    }


@router.put("/{artist_id}")
async def update_artist(
    artist_id: UUID,
    data: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ArtistResponse:
    """
    Update artist details including Spotify link.

    Accepts: name, external_id, spotify_id, image_url, image_url_small
    """
    result = await db.execute(select(Artist).where(Artist.id == artist_id))
    artist = result.scalar_one_or_none()

    if not artist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    # Update allowed fields
    if "name" in data and data["name"]:
        artist.name = data["name"]
    if "category" in data and data["category"] in ("signed", "collaborator"):
        artist.category = data["category"]
    if "external_id" in data:
        artist.external_id = data["external_id"]
    if "spotify_id" in data:
        artist.spotify_id = data["spotify_id"]
    if "image_url" in data:
        artist.image_url = data["image_url"]
    if "image_url_small" in data:
        artist.image_url_small = data["image_url_small"]

    await db.flush()

    return ArtistResponse(
        id=artist.id,
        name=artist.name,
        category=artist.category or "signed",
        external_id=artist.external_id,
        spotify_id=artist.spotify_id,
        image_url=artist.image_url,
        image_url_small=artist.image_url_small,
        created_at=artist.created_at,
    )


@router.get("/collaborations/detect")
async def detect_collaborations(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> list[dict]:
    """
    Detect collaborative artists (names containing & or x) and their component artists.
    Returns list of collaborations with info about individual artists.
    """
    result = await db.execute(select(Artist).order_by(Artist.name))
    all_artists = result.scalars().all()

    # Build name -> artist map
    artist_map = {a.name.lower(): a for a in all_artists}

    collaborations = []
    for artist in all_artists:
        name = artist.name
        # Check for collaboration patterns
        if ' & ' in name or ' x ' in name.lower():
            # Split by & or x
            import re
            parts = re.split(r'\s+[&xX]\s+', name)
            parts = [p.strip() for p in parts if p.strip()]

            if len(parts) > 1:
                individual_artists = []
                for part in parts:
                    existing = artist_map.get(part.lower())
                    individual_artists.append({
                        "name": part,
                        "exists": existing is not None,
                        "artist_id": str(existing.id) if existing else None,
                    })

                collaborations.append({
                    "collaboration_id": str(artist.id),
                    "collaboration_name": name,
                    "individual_artists": individual_artists,
                    "all_exist": all(a["exists"] for a in individual_artists),
                })

    return collaborations


@router.post("/collaborations/{collab_id}/create-individuals")
async def create_individual_artists(
    collab_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Create individual artists from a collaboration if they don't exist.
    """
    import re

    # Get the collaboration artist
    result = await db.execute(select(Artist).where(Artist.id == collab_id))
    collab = result.scalar_one_or_none()

    if not collab:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Collaboration {collab_id} not found",
        )

    # Split the name
    parts = re.split(r'\s+[&xX]\s+', collab.name)
    parts = [p.strip() for p in parts if p.strip()]

    if len(parts) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This artist is not a collaboration",
        )

    created = []
    existing = []

    for part in parts:
        # Check if artist exists (case-insensitive)
        result = await db.execute(
            select(Artist).where(func.lower(Artist.name) == part.lower())
        )
        artist = result.scalar_one_or_none()

        if artist:
            existing.append({"id": str(artist.id), "name": artist.name})
        else:
            # Create the artist
            new_artist = Artist(name=part)
            db.add(new_artist)
            await db.flush()
            created.append({"id": str(new_artist.id), "name": new_artist.name})

    return {
        "success": True,
        "collaboration": {"id": str(collab.id), "name": collab.name},
        "created": created,
        "existing": existing,
    }


@router.post("/collaborations/{collab_id}/resolve")
async def resolve_collaboration(
    collab_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    shares: List[Decimal] = None,
    delete_after: bool = True,
) -> dict:
    """
    Resolve a collaboration artist into individual track-artist links.

    This will:
    1. Split the collaboration name into individual artists
    2. Create the individual artists if they don't exist
    3. Find all tracks (ISRCs) associated with the collaboration name
    4. Create TrackArtistLink entries for each track linking to each individual artist
    5. Delete the collaboration artist (if delete_after=True)

    Args:
        collab_id: The UUID of the collaboration artist
        shares: Optional list of share percentages for each artist (must sum to 1.0)
                If not provided, shares are split equally.
        delete_after: If True (default), delete the collaboration artist after resolving.
    """
    import re
    from app.models.track_artist_link import TrackArtistLink

    # Get the collaboration artist
    result = await db.execute(select(Artist).where(Artist.id == collab_id))
    collab = result.scalar_one_or_none()

    if not collab:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {collab_id} not found",
        )

    # Split the collaboration name
    parts = re.split(r'\s+[&xX]\s+', collab.name)
    parts = [p.strip() for p in parts if p.strip()]

    if len(parts) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{collab.name}' doesn't appear to be a collaboration (no '&' or 'x' found)",
        )

    # Validate or create shares
    if shares:
        if len(shares) != len(parts):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Expected {len(parts)} shares but got {len(shares)}",
            )
        total = sum(shares)
        if abs(total - Decimal("1")) > Decimal("0.001"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Shares must sum to 1.0 (got {total})",
            )
    else:
        # Equal shares for each artist
        share_value = Decimal("1") / Decimal(str(len(parts)))
        shares = [share_value] * len(parts)

    # Create or find individual artists
    individual_artists = []
    for part in parts:
        result = await db.execute(
            select(Artist).where(func.lower(Artist.name) == part.lower())
        )
        artist = result.scalars().first()

        if not artist:
            artist = Artist(name=part)
            db.add(artist)
            await db.flush()

        individual_artists.append(artist)

    # Find all ISRCs associated with this collaboration name
    isrc_result = await db.execute(
        select(
            TransactionNormalized.isrc,
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
            TransactionNormalized.upc,
        )
        .where(
            TransactionNormalized.artist_name == collab.name,
            TransactionNormalized.isrc.isnot(None),
        )
        .distinct()
    )
    tracks = isrc_result.all()

    if not tracks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No tracks found with ISRC for collaboration '{collab.name}'",
        )

    # Create track-artist links
    links_created = 0
    links_skipped = 0
    for track in tracks:
        for artist, share in zip(individual_artists, shares):
            # Check if link already exists
            existing = await db.execute(
                select(TrackArtistLink).where(
                    TrackArtistLink.isrc == track.isrc,
                    TrackArtistLink.artist_id == artist.id,
                )
            )
            if existing.scalar_one_or_none():
                links_skipped += 1
                continue

            link = TrackArtistLink(
                isrc=track.isrc,
                artist_id=artist.id,
                share_percent=share,
                track_title=track.track_title,
                release_title=track.release_title,
                upc=track.upc,
            )
            db.add(link)
            links_created += 1

    await db.flush()

    # Delete collaboration artist if requested
    deleted = False
    if delete_after:
        await db.delete(collab)
        await db.flush()
        deleted = True

    return {
        "success": True,
        "collaboration": {"id": str(collab.id), "name": collab.name, "deleted": deleted},
        "individual_artists": [
            {"id": str(a.id), "name": a.name, "share": str(s)}
            for a, s in zip(individual_artists, shares)
        ],
        "tracks_found": len(tracks),
        "links_created": links_created,
        "links_skipped": links_skipped,
    }


@router.post("/collaborations/resolve-all")
async def resolve_all_collaborations(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    delete_after: bool = True,
) -> dict:
    """
    Resolve ALL collaboration artists at once.

    Detects all artists with '&' or 'x' in their name, creates track-artist links
    for the individual artists, and optionally deletes the collaboration artists.
    """
    import re
    from app.models.track_artist_link import TrackArtistLink

    # Get all artists
    result = await db.execute(select(Artist).order_by(Artist.name))
    all_artists = result.scalars().all()

    # Build name -> artist map
    artist_map = {a.name.lower(): a for a in all_artists}

    resolved = []
    errors = []

    for artist in all_artists:
        name = artist.name
        # Check for collaboration patterns
        if ' & ' not in name and ' x ' not in name.lower():
            continue

        # Split by & or x
        parts = re.split(r'\s+[&xX]\s+', name)
        parts = [p.strip() for p in parts if p.strip()]

        if len(parts) <= 1:
            continue

        # Equal shares
        share_value = Decimal("1") / Decimal(str(len(parts)))

        # Create or find individual artists
        individual_artists = []
        for part in parts:
            existing = artist_map.get(part.lower())
            if not existing:
                existing = Artist(name=part)
                db.add(existing)
                await db.flush()
                artist_map[part.lower()] = existing
            individual_artists.append(existing)

        # Find all ISRCs for this collaboration
        isrc_result = await db.execute(
            select(
                TransactionNormalized.isrc,
                TransactionNormalized.track_title,
                TransactionNormalized.release_title,
                TransactionNormalized.upc,
            )
            .where(
                TransactionNormalized.artist_name == name,
                TransactionNormalized.isrc.isnot(None),
            )
            .distinct()
        )
        tracks = isrc_result.all()

        if not tracks:
            errors.append({"name": name, "error": "No tracks with ISRC found"})
            continue

        # Create track-artist links
        links_created = 0
        for track in tracks:
            for ind_artist, share in zip(individual_artists, [share_value] * len(individual_artists)):
                existing_link = await db.execute(
                    select(TrackArtistLink).where(
                        TrackArtistLink.isrc == track.isrc,
                        TrackArtistLink.artist_id == ind_artist.id,
                    )
                )
                if existing_link.scalar_one_or_none():
                    continue

                link = TrackArtistLink(
                    isrc=track.isrc,
                    artist_id=ind_artist.id,
                    share_percent=share,
                    track_title=track.track_title,
                    release_title=track.release_title,
                    upc=track.upc,
                )
                db.add(link)
                links_created += 1

        # Delete collaboration artist
        if delete_after:
            await db.delete(artist)

        resolved.append({
            "name": name,
            "individual_artists": [a.name for a in individual_artists],
            "tracks_found": len(tracks),
            "links_created": links_created,
            "deleted": delete_after,
        })

    await db.flush()

    return {
        "success": True,
        "resolved_count": len(resolved),
        "resolved": resolved,
        "errors": errors,
    }


@router.delete("/{artist_id}")
async def delete_artist(
    artist_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Delete an artist.

    Warning: This will also delete all associated contracts and advances.
    """
    result = await db.execute(select(Artist).where(Artist.id == artist_id))
    artist = result.scalar_one_or_none()

    if not artist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    await db.delete(artist)
    await db.flush()

    return {"success": True, "deleted_id": str(artist_id)}


# Contract endpoints

@router.post("/{artist_id}/contracts", response_model=ContractResponse)
async def create_contract(
    artist_id: UUID,
    data: ContractCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ContractResponse:
    """
    Create a new contract for an artist.

    Contracts define royalty splits between artist and label.
    Scope determines which transactions the contract applies to:
    - 'track': Specific track (requires scope_id as ISRC)
    - 'release': Specific release (requires scope_id as UPC)
    - 'catalog': All artist's catalog (scope_id must be null)
    """
    # Verify artist exists
    result = await db.execute(
        select(Artist).where(Artist.id == artist_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    # Validate scope
    try:
        scope = ContractScope(data.scope.lower())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scope: {data.scope}. Must be 'track', 'release', or 'catalog'",
        )

    # Validate scope_id
    if scope == ContractScope.CATALOG and data.scope_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scope_id must be null for catalog scope",
        )
    if scope in (ContractScope.TRACK, ContractScope.RELEASE) and data.scope_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"scope_id is required for {scope.value} scope",
        )

    # Validate shares sum to 1 (with tolerance for floating point)
    total = data.artist_share + data.label_share
    if abs(total - Decimal("1")) > Decimal("0.001"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"artist_share + label_share must equal 1.0 (got {total})",
        )
    # Normalize to exactly 1.0
    data.label_share = Decimal("1") - data.artist_share

    contract = Contract(
        artist_id=artist_id,
        scope=scope,
        scope_id=data.scope_id,
        artist_share=data.artist_share,
        label_share=data.label_share,
        start_date=data.start_date,
        end_date=data.end_date,
        description=data.description,
    )
    db.add(contract)
    await db.flush()

    return ContractResponse(
        id=contract.id,
        artist_id=contract.artist_id,
        scope=contract.scope.value,
        scope_id=contract.scope_id,
        artist_share=contract.artist_share,
        label_share=contract.label_share,
        start_date=contract.start_date,
        end_date=contract.end_date,
        description=contract.description,
        created_at=contract.created_at,
    )


@router.get("/{artist_id}/contracts", response_model=List[ContractResponse])
async def list_contracts(
    artist_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> List[ContractResponse]:
    """List all contracts for an artist."""
    # Verify artist exists
    result = await db.execute(
        select(Artist).where(Artist.id == artist_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    result = await db.execute(
        select(Contract)
        .where(Contract.artist_id == artist_id)
        .order_by(Contract.start_date.desc())
    )
    contracts = result.scalars().all()

    return [
        ContractResponse(
            id=contract.id,
            artist_id=contract.artist_id,
            scope=contract.scope.value,
            scope_id=contract.scope_id,
            artist_share=contract.artist_share,
            label_share=contract.label_share,
            start_date=contract.start_date,
            end_date=contract.end_date,
            description=contract.description,
            created_at=contract.created_at,
        )
        for contract in contracts
    ]


@router.put("/{artist_id}/contracts/{contract_id}", response_model=ContractResponse)
async def update_contract(
    artist_id: UUID,
    contract_id: UUID,
    data: ContractCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ContractResponse:
    """
    Update an existing contract.

    Note: Changing a contract may affect past royalty calculations.
    Consider creating a new contract with a new start_date instead.
    """
    # Verify contract exists and belongs to artist
    result = await db.execute(
        select(Contract).where(
            Contract.id == contract_id,
            Contract.artist_id == artist_id,
        )
    )
    contract = result.scalar_one_or_none()

    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contract {contract_id} not found for artist {artist_id}",
        )

    # Validate scope
    try:
        scope = ContractScope(data.scope.lower())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scope: {data.scope}. Must be 'track', 'release', or 'catalog'",
        )

    # Validate scope_id
    if scope == ContractScope.CATALOG and data.scope_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scope_id must be null for catalog scope",
        )
    if scope in (ContractScope.TRACK, ContractScope.RELEASE) and data.scope_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"scope_id is required for {scope.value} scope",
        )

    # Validate shares sum to 1
    total = data.artist_share + data.label_share
    if abs(total - Decimal("1")) > Decimal("0.001"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"artist_share + label_share must equal 1.0 (got {total})",
        )

    # Update contract
    contract.scope = scope
    contract.scope_id = data.scope_id
    contract.artist_share = data.artist_share
    contract.label_share = Decimal("1") - data.artist_share
    contract.start_date = data.start_date
    contract.end_date = data.end_date
    contract.description = data.description

    await db.flush()

    return ContractResponse(
        id=contract.id,
        artist_id=contract.artist_id,
        scope=contract.scope.value,
        scope_id=contract.scope_id,
        artist_share=contract.artist_share,
        label_share=contract.label_share,
        start_date=contract.start_date,
        end_date=contract.end_date,
        description=contract.description,
        created_at=contract.created_at,
    )


@router.delete("/{artist_id}/contracts/{contract_id}")
async def delete_contract(
    artist_id: UUID,
    contract_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Delete a contract.

    Warning: This may affect royalty calculations for periods
    where this contract was applicable.
    """
    # Verify contract exists and belongs to artist
    result = await db.execute(
        select(Contract).where(
            Contract.id == contract_id,
            Contract.artist_id == artist_id,
        )
    )
    contract = result.scalar_one_or_none()

    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contract {contract_id} not found for artist {artist_id}",
        )

    await db.delete(contract)
    await db.flush()

    return {"success": True, "deleted_id": str(contract_id)}


# Advance endpoints

@router.post("/{artist_id}/advances", response_model=AdvanceLedgerEntryResponse)
async def create_advance(
    artist_id: UUID,
    data: AdvanceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> AdvanceLedgerEntryResponse:
    """
    Record an advance payment to an artist.

    Advances will be recouped from future royalty payments.
    Scope determines which transactions the advance is recouped from:
    - 'track': Specific track (requires scope_id as ISRC)
    - 'release': Specific release (requires scope_id as UPC)
    - 'catalog': All artist's catalog (scope_id must be null)
    """
    # Verify artist exists
    result = await db.execute(
        select(Artist).where(Artist.id == artist_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    # Validate scope
    scope = data.scope.lower() if data.scope else "catalog"
    if scope not in ("track", "release", "catalog"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scope: {scope}. Must be 'track', 'release', or 'catalog'",
        )

    # Validate scope_id
    if scope == "catalog" and data.scope_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scope_id must be null for catalog scope",
        )
    if scope in ("track", "release") and data.scope_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"scope_id is required for {scope} scope",
        )

    entry = AdvanceLedgerEntry(
        artist_id=artist_id,
        entry_type=LedgerEntryType.ADVANCE,
        amount=data.amount,
        currency=data.currency,
        scope=scope,
        scope_id=data.scope_id,
        category=data.category,
        description=data.description,
        reference=data.reference,
    )
    db.add(entry)
    await db.flush()

    return AdvanceLedgerEntryResponse(
        id=entry.id,
        artist_id=entry.artist_id,
        entry_type=entry.entry_type.value,
        amount=entry.amount,
        currency=entry.currency,
        scope=entry.scope,
        scope_id=entry.scope_id,
        category=entry.category,
        royalty_run_id=entry.royalty_run_id,
        description=entry.description,
        reference=entry.reference,
        effective_date=entry.effective_date,
        created_at=entry.created_at,
    )


@router.get("/{artist_id}/advances", response_model=List[AdvanceLedgerEntryResponse])
async def list_advance_entries(
    artist_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> List[AdvanceLedgerEntryResponse]:
    """List all advance and recoupment entries for an artist."""
    # Verify artist exists
    result = await db.execute(
        select(Artist).where(Artist.id == artist_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    result = await db.execute(
        select(AdvanceLedgerEntry)
        .where(AdvanceLedgerEntry.artist_id == artist_id)
        .order_by(AdvanceLedgerEntry.effective_date.desc())
    )
    entries = result.scalars().all()

    return [
        AdvanceLedgerEntryResponse(
            id=entry.id,
            artist_id=entry.artist_id,
            entry_type=entry.entry_type.value,
            amount=entry.amount,
            currency=entry.currency,
            scope=getattr(entry, 'scope', 'catalog') or 'catalog',
            scope_id=getattr(entry, 'scope_id', None),
            category=getattr(entry, 'category', None),
            royalty_run_id=entry.royalty_run_id,
            description=entry.description,
            reference=entry.reference,
            effective_date=entry.effective_date,
            created_at=entry.created_at,
        )
        for entry in entries
    ]


@router.put("/{artist_id}/advances/{advance_id}", response_model=AdvanceLedgerEntryResponse)
async def update_advance(
    artist_id: UUID,
    advance_id: UUID,
    data: AdvanceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> AdvanceLedgerEntryResponse:
    """
    Update an existing advance entry.

    Only advances can be updated (not recoupments).
    """
    # Verify artist exists
    result = await db.execute(
        select(Artist).where(Artist.id == artist_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    # Get the advance entry
    result = await db.execute(
        select(AdvanceLedgerEntry).where(
            AdvanceLedgerEntry.id == advance_id,
            AdvanceLedgerEntry.artist_id == artist_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Advance {advance_id} not found",
        )

    # Allow updating advances and recoupments (but not payments)
    if entry.entry_type == LedgerEntryType.PAYMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payments cannot be updated through this endpoint",
        )

    # Validate scope
    scope = data.scope.lower() if data.scope else "catalog"
    if scope not in ("track", "release", "catalog"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scope: {scope}. Must be 'track', 'release', or 'catalog'",
        )

    # Validate scope_id
    if scope == "catalog" and data.scope_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scope_id must be null for catalog scope",
        )
    if scope in ("track", "release") and data.scope_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"scope_id is required for {scope} scope",
        )

    # Update the entry
    entry.amount = data.amount
    entry.currency = data.currency
    entry.scope = scope
    entry.scope_id = data.scope_id
    entry.category = data.category
    entry.description = data.description
    entry.reference = data.reference
    await db.flush()

    return AdvanceLedgerEntryResponse(
        id=entry.id,
        artist_id=entry.artist_id,
        entry_type=entry.entry_type.value,
        amount=entry.amount,
        currency=entry.currency,
        scope=entry.scope,
        scope_id=entry.scope_id,
        category=entry.category,
        royalty_run_id=entry.royalty_run_id,
        description=entry.description,
        reference=entry.reference,
        effective_date=entry.effective_date,
        created_at=entry.created_at,
    )


@router.delete("/{artist_id}/advances/{advance_id}")
async def delete_advance(
    artist_id: UUID,
    advance_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Delete an advance entry.

    Only advances can be deleted (not recoupments).
    Warning: This will affect the artist's advance balance.
    """
    # Verify artist exists
    result = await db.execute(
        select(Artist).where(Artist.id == artist_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    # Get the advance entry
    result = await db.execute(
        select(AdvanceLedgerEntry).where(
            AdvanceLedgerEntry.id == advance_id,
            AdvanceLedgerEntry.artist_id == artist_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Advance {advance_id} not found",
        )

    # Allow deleting advances and recoupments (but not payments)
    if entry.entry_type == LedgerEntryType.PAYMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payments cannot be deleted through this endpoint",
        )

    await db.delete(entry)
    await db.flush()

    return {"success": True, "deleted_id": str(advance_id)}


@router.get("/{artist_id}/advance-balance", response_model=AdvanceBalanceResponse)
async def get_advance_balance(
    artist_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> AdvanceBalanceResponse:
    """
    Get current advance balance for an artist.

    balance = sum(advances) - sum(recoupments)
    Positive balance means artist has unrecouped advance.
    """
    # Verify artist exists
    result = await db.execute(
        select(Artist).where(Artist.id == artist_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    # Sum advances
    advance_result = await db.execute(
        select(func.coalesce(func.sum(AdvanceLedgerEntry.amount), 0)).where(
            AdvanceLedgerEntry.artist_id == artist_id,
            AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE,
        )
    )
    total_advances = Decimal(str(advance_result.scalar()))

    # Sum recoupments
    recoupment_result = await db.execute(
        select(func.coalesce(func.sum(AdvanceLedgerEntry.amount), 0)).where(
            AdvanceLedgerEntry.artist_id == artist_id,
            AdvanceLedgerEntry.entry_type == LedgerEntryType.RECOUPMENT,
        )
    )
    total_recoupments = Decimal(str(recoupment_result.scalar()))

    balance = total_advances - total_recoupments

    return AdvanceBalanceResponse(
        artist_id=artist_id,
        balance=balance,
        currency="EUR",
    )


# Payment endpoints

@router.post("/{artist_id}/payments", response_model=AdvanceLedgerEntryResponse)
async def create_payment(
    artist_id: UUID,
    data: PaymentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> AdvanceLedgerEntryResponse:
    """
    Record a payment made to an artist.

    Payments represent money transferred to the artist (royalties paid out).
    This helps track what has been paid vs what is still owed.
    """
    from datetime import datetime as dt

    # Verify artist exists
    result = await db.execute(
        select(Artist).where(Artist.id == artist_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    # Create payment entry
    effective_date = dt.combine(data.payment_date, dt.min.time()) if data.payment_date else dt.utcnow()

    entry = AdvanceLedgerEntry(
        artist_id=artist_id,
        entry_type=LedgerEntryType.PAYMENT,
        amount=data.amount,
        currency=data.currency,
        scope="catalog",
        scope_id=None,
        description=data.description,
        effective_date=effective_date,
    )
    db.add(entry)
    await db.flush()

    return AdvanceLedgerEntryResponse(
        id=entry.id,
        artist_id=entry.artist_id,
        entry_type=entry.entry_type.value,
        amount=entry.amount,
        currency=entry.currency,
        scope=entry.scope,
        scope_id=entry.scope_id,
        category=getattr(entry, 'category', None),
        royalty_run_id=entry.royalty_run_id,
        description=entry.description,
        reference=entry.reference,
        effective_date=entry.effective_date,
        created_at=entry.created_at,
    )


@router.get("/{artist_id}/payments", response_model=List[AdvanceLedgerEntryResponse])
async def list_payments(
    artist_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> List[AdvanceLedgerEntryResponse]:
    """List all payments made to an artist."""
    # Verify artist exists
    result = await db.execute(
        select(Artist).where(Artist.id == artist_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    result = await db.execute(
        select(AdvanceLedgerEntry)
        .where(
            AdvanceLedgerEntry.artist_id == artist_id,
            AdvanceLedgerEntry.entry_type == LedgerEntryType.PAYMENT,
        )
        .order_by(AdvanceLedgerEntry.effective_date.desc())
    )
    entries = result.scalars().all()

    return [
        AdvanceLedgerEntryResponse(
            id=entry.id,
            artist_id=entry.artist_id,
            entry_type=entry.entry_type.value,
            amount=entry.amount,
            currency=entry.currency,
            scope=getattr(entry, 'scope', 'catalog') or 'catalog',
            scope_id=getattr(entry, 'scope_id', None),
            category=getattr(entry, 'category', None),
            royalty_run_id=entry.royalty_run_id,
            description=entry.description,
            reference=entry.reference,
            effective_date=entry.effective_date,
            created_at=entry.created_at,
        )
        for entry in entries
    ]


@router.delete("/{artist_id}/payments/{payment_id}")
async def delete_payment(
    artist_id: UUID,
    payment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """Delete a payment entry."""
    # Verify artist exists
    result = await db.execute(
        select(Artist).where(Artist.id == artist_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    # Get the payment entry
    result = await db.execute(
        select(AdvanceLedgerEntry).where(
            AdvanceLedgerEntry.id == payment_id,
            AdvanceLedgerEntry.artist_id == artist_id,
            AdvanceLedgerEntry.entry_type == LedgerEntryType.PAYMENT,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment {payment_id} not found",
        )

    await db.delete(entry)
    await db.flush()

    return {"success": True, "deleted_id": str(payment_id)}


# Royalty calculation per artist

from pydantic import BaseModel
from datetime import date
from app.models.transaction import TransactionNormalized
from app.models.contract import ContractScope


class AlbumRoyalty(BaseModel):
    """Royalty breakdown for a single album."""
    release_title: str
    upc: str
    track_count: int
    gross: str
    artist_share: str
    label_share: str
    artist_royalties: str
    label_royalties: str
    streams: int
    advance_balance: str = "0"  # Scoped advances for this album
    recoupable: str = "0"       # Amount deducted from this album
    net_payable: str = "0"      # Net after scoped advance deduction
    included_in_upc: Optional[str] = None  # If this single is included in an album's recoupment


class SourceBreakdown(BaseModel):
    """Royalty breakdown by source (TuneCore, Bandcamp, etc.)."""
    source: str
    source_label: str
    gross: str
    artist_royalties: str
    label_royalties: str
    transaction_count: int
    streams: int


class ArtistRoyaltyCalculation(BaseModel):
    """Result of royalty calculation for an artist."""
    artist_id: str
    artist_name: str
    period_start: date
    period_end: date
    currency: str
    total_gross: str
    total_artist_royalties: str
    total_label_royalties: str
    # Advance tracking - clear breakdown
    total_advances: str  # Total advances given to artist
    total_recouped_before: str  # Already recouped in previous periods
    recoupable: str  # Amount recouped THIS period
    remaining_advance: str  # What's left to recoup after this period
    # Legacy field for backwards compatibility
    advance_balance: str  # = total_advances - total_recouped_before (current balance before this period)
    net_payable: str
    albums: list[AlbumRoyalty]
    sources: list[SourceBreakdown]


@router.post("/{artist_id}/calculate-royalties", response_model=ArtistRoyaltyCalculation)
async def calculate_artist_royalties(
    artist_id: UUID,
    period_start: date,
    period_end: date,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ArtistRoyaltyCalculation:
    """
    Calculate royalties for a specific artist over a given period.

    Returns breakdown by album with artist/label shares applied.
    Considers contracts at track, release, and catalog levels.
    """
    from sqlalchemy import distinct
    from sqlalchemy.orm import selectinload

    # Get artist
    result = await db.execute(select(Artist).where(Artist.id == artist_id))
    artist = result.scalar_one_or_none()
    if not artist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    # Get all contracts for this artist (valid in the period)
    from sqlalchemy import and_, or_
    validity_condition = and_(
        Contract.start_date <= period_end,
        or_(
            Contract.end_date.is_(None),
            Contract.end_date >= period_start,
        ),
    )
    contract_result = await db.execute(
        select(Contract).where(
            Contract.artist_id == artist_id,
            validity_condition,
        )
    )
    contracts = contract_result.scalars().all()

    # Index contracts for fast lookup
    track_contracts = {c.scope_id: c for c in contracts if c.scope == ContractScope.TRACK and c.scope_id}
    release_contracts = {c.scope_id: c for c in contracts if c.scope == ContractScope.RELEASE and c.scope_id}
    catalog_contract = next((c for c in contracts if c.scope == ContractScope.CATALOG), None)

    # Get track-artist links for this artist (for collaborations)
    from app.models.track_artist_link import TrackArtistLink
    links_result = await db.execute(
        select(TrackArtistLink).where(TrackArtistLink.artist_id == artist_id)
    )
    artist_links = links_result.scalars().all()
    linked_isrcs = {link.isrc for link in artist_links}
    link_shares = {link.isrc: link.share_percent for link in artist_links}

    # Get transactions grouped by album with source info
    # Include transactions where artist_name matches OR ISRC is in track-artist links
    from app.models.import_model import Import
    tx_result = await db.execute(
        select(
            TransactionNormalized.release_title,
            TransactionNormalized.upc,
            TransactionNormalized.isrc,
            TransactionNormalized.gross_amount,
            TransactionNormalized.quantity,
            TransactionNormalized.artist_name,
            Import.source,
        )
        .join(Import, TransactionNormalized.import_id == Import.id)
        .where(
            or_(
                TransactionNormalized.artist_name == artist.name,
                TransactionNormalized.isrc.in_(linked_isrcs) if linked_isrcs else False,
            ),
            TransactionNormalized.period_start >= period_start,
            TransactionNormalized.period_end <= period_end,
        )
    )
    transactions = tx_result.all()

    # Aggregate by album and source
    albums_data: dict = {}  # upc -> {data}
    sources_data: dict = {}  # source -> {data}

    # Source labels mapping
    source_labels = {
        "tunecore": "TuneCore",
        "believe": "Believe",
        "believe_uk": "Believe UK",
        "believe_fr": "Believe FR",
        "cdbaby": "CD Baby",
        "bandcamp": "Bandcamp",
        "other": "Autre",
    }

    for tx in transactions:
        upc = tx.upc or "UNKNOWN"
        source = tx.source.value.lower() if tx.source else "other"

        # Initialize album data
        if upc not in albums_data:
            albums_data[upc] = {
                "release_title": tx.release_title or "(Sans album)",
                "upc": upc,
                "tracks": set(),
                "gross": Decimal("0"),
                "artist_royalties": Decimal("0"),
                "label_royalties": Decimal("0"),
                "streams": 0,
            }

        # Initialize source data
        if source not in sources_data:
            sources_data[source] = {
                "source": source,
                "source_label": source_labels.get(source, source.capitalize()),
                "gross": Decimal("0"),
                "artist_royalties": Decimal("0"),
                "label_royalties": Decimal("0"),
                "transaction_count": 0,
                "streams": 0,
            }

        album = albums_data[upc]
        src = sources_data[source]

        # Determine if this is a collaboration transaction
        # If artist_name doesn't match but ISRC is in linked_isrcs, apply share_percent
        base_amount = tx.gross_amount or Decimal("0")
        collab_share = Decimal("1")  # Default: 100% if not a collab

        if tx.artist_name != artist.name and tx.isrc and tx.isrc in link_shares:
            # This is a collaboration - apply the artist's share from track-artist link
            collab_share = link_shares[tx.isrc]

        # The amount this artist gets from this transaction
        amount = base_amount * collab_share

        album["tracks"].add(tx.isrc)
        album["gross"] += amount
        album["streams"] += tx.quantity or 0

        src["gross"] += amount
        src["streams"] += tx.quantity or 0
        src["transaction_count"] += 1

        # Find applicable contract (priority: track > release > catalog)
        contract = None
        if tx.isrc and tx.isrc in track_contracts:
            contract = track_contracts[tx.isrc]
        elif upc in release_contracts:
            contract = release_contracts[upc]
        elif catalog_contract:
            contract = catalog_contract

        # Apply contract split (artist vs label)
        if contract:
            artist_share = contract.artist_share
            label_share = contract.label_share
        else:
            artist_share = Decimal("0.5")
            label_share = Decimal("0.5")
        album["artist_royalties"] += amount * artist_share
        album["label_royalties"] += amount * label_share
        src["artist_royalties"] += amount * artist_share
        src["label_royalties"] += amount * label_share

    # Calculate totals
    total_gross = sum(a["gross"] for a in albums_data.values())
    total_artist = sum(a["artist_royalties"] for a in albums_data.values())
    total_label = sum(a["label_royalties"] for a in albums_data.values())

    # Get all advances and recoupments with scope info
    # Include both artist-specific advances AND shared advances (artist_id = NULL)
    advances_result = await db.execute(
        select(AdvanceLedgerEntry).where(
            AdvanceLedgerEntry.artist_id == artist_id,
        )
    )
    artist_entries = advances_result.scalars().all()

    # Get shared advances (artist_id = NULL) for tracks/releases this artist has
    all_isrcs = set()
    all_upcs = set()
    for album in albums_data.values():
        all_upcs.add(album["upc"])
        all_isrcs.update(album["tracks"])
    all_isrcs.discard(None)

    shared_advances_result = await db.execute(
        select(AdvanceLedgerEntry).where(
            AdvanceLedgerEntry.artist_id.is_(None),
            or_(
                and_(AdvanceLedgerEntry.scope == "track", AdvanceLedgerEntry.scope_id.in_(all_isrcs)) if all_isrcs else False,
                and_(AdvanceLedgerEntry.scope == "release", AdvanceLedgerEntry.scope_id.in_(all_upcs)) if all_upcs else False,
            )
        )
    )
    shared_entries = shared_advances_result.scalars().all()

    # Combine all entries
    all_entries = list(artist_entries) + list(shared_entries)

    # Calculate total advances (just the ADVANCE entries, not recoupments)
    sum_total_advances = Decimal("0")
    sum_ledger_recoupments = Decimal("0")
    for entry in all_entries:
        if entry.entry_type == LedgerEntryType.ADVANCE:
            sum_total_advances += entry.amount
        elif entry.entry_type == LedgerEntryType.RECOUPMENT:
            sum_ledger_recoupments += entry.amount

    # Group advances and recoupments by scope
    # Structure: {scope: {scope_id: balance}}
    release_advances: dict[str, Decimal] = {}  # UPC -> balance
    track_advances: dict[str, Decimal] = {}    # ISRC -> balance
    shared_release_advances: dict[str, Decimal] = {}  # Shared UPC -> balance (for display)
    shared_track_advances: dict[str, Decimal] = {}    # Shared ISRC -> balance (for display)
    catalog_balance = Decimal("0")

    for entry in all_entries:
        amount = entry.amount if entry.entry_type == LedgerEntryType.ADVANCE else -entry.amount
        is_shared = entry.artist_id is None

        if entry.scope == "release" and entry.scope_id:
            release_advances[entry.scope_id] = release_advances.get(entry.scope_id, Decimal("0")) + amount
            if is_shared:
                shared_release_advances[entry.scope_id] = shared_release_advances.get(entry.scope_id, Decimal("0")) + amount
        elif entry.scope == "track" and entry.scope_id:
            track_advances[entry.scope_id] = track_advances.get(entry.scope_id, Decimal("0")) + amount
            if is_shared:
                shared_track_advances[entry.scope_id] = shared_track_advances.get(entry.scope_id, Decimal("0")) + amount
        else:  # catalog scope
            catalog_balance += amount

    # For cumulative recoupment: get ALL historical revenues up to period_end
    # This allows advances to be recouped over time across multiple periods
    cumulative_revenues_by_upc: dict[str, Decimal] = {}
    cumulative_revenues_by_isrc: dict[str, Decimal] = {}
    historical_revenues_before_period: dict[str, Decimal] = {}  # For showing "already recouped"

    # Get all relevant UPCs and ISRCs that have advances
    upc_with_advances = set(release_advances.keys())
    isrc_with_advances = set(track_advances.keys())

    # IMPORTANT: Also get ISRCs from albums that have release-level advances
    # This allows album advances to recoup from singles with the same tracks
    for upc in upc_with_advances:
        if upc in albums_data:
            isrc_with_advances.update(albums_data[upc]["tracks"])

    # Only query if there are scoped advances
    if upc_with_advances or isrc_with_advances:
        # Query cumulative revenues from beginning of time until period_end
        cumulative_query = (
            select(
                TransactionNormalized.upc,
                TransactionNormalized.isrc,
                func.sum(TransactionNormalized.gross_amount).label("total_gross"),
            )
            .join(Import, TransactionNormalized.import_id == Import.id)
            .where(
                or_(
                    TransactionNormalized.artist_name == artist.name,
                    TransactionNormalized.isrc.in_(linked_isrcs) if linked_isrcs else False,
                ),
                TransactionNormalized.period_end <= period_end,
            )
            .group_by(TransactionNormalized.upc, TransactionNormalized.isrc)
        )
        cumulative_result = await db.execute(cumulative_query)

        for row in cumulative_result.all():
            if row.upc and row.upc in upc_with_advances:
                cumulative_revenues_by_upc[row.upc] = cumulative_revenues_by_upc.get(row.upc, Decimal("0")) + (row.total_gross or Decimal("0"))
            if row.isrc and row.isrc in isrc_with_advances:
                cumulative_revenues_by_isrc[row.isrc] = cumulative_revenues_by_isrc.get(row.isrc, Decimal("0")) + (row.total_gross or Decimal("0"))

        # Query revenues BEFORE this period (to show what was already recouped)
        if period_start:
            historical_query = (
                select(
                    TransactionNormalized.upc,
                    TransactionNormalized.isrc,
                    func.sum(TransactionNormalized.gross_amount).label("total_gross"),
                )
                .join(Import, TransactionNormalized.import_id == Import.id)
                .where(
                    or_(
                        TransactionNormalized.artist_name == artist.name,
                        TransactionNormalized.isrc.in_(linked_isrcs) if linked_isrcs else False,
                    ),
                    TransactionNormalized.period_end < period_start,
                )
                .group_by(TransactionNormalized.upc, TransactionNormalized.isrc)
            )
            historical_result = await db.execute(historical_query)

            for row in historical_result.all():
                key = f"{row.upc}_{row.isrc}"
                historical_revenues_before_period[key] = row.total_gross or Decimal("0")

    # Build mapping of UPC → ISRCs for albums with advances
    # This allows album advances to also recoup from singles containing the same tracks
    upc_to_isrcs: dict[str, set] = {}
    for upc, album in albums_data.items():
        if upc in release_advances:
            upc_to_isrcs[upc] = album["tracks"]

    # Apply scoped advances to each album with CUMULATIVE recoupment
    total_scoped_recoupable = Decimal("0")

    # Track which singles are included in albums (for display purposes)
    singles_included_in: dict[str, str] = {}  # single_upc -> album_upc

    for upc, album in albums_data.items():
        album_advance_balance = Decimal("0")
        album_cumulative_revenues = Decimal("0")
        album_historical_revenues = Decimal("0")

        # Add release-level advance for this album
        album_isrcs_for_release_advance = set()
        if upc in release_advances:
            album_advance_balance += release_advances[upc]
            album_isrcs_for_release_advance = upc_to_isrcs.get(upc, set())

            # IMPORTANT: Include royalties from singles that contain the same tracks
            # Album advances should recoup from singles with same ISRC but different UPC
            for other_upc, other_album in albums_data.items():
                if other_upc != upc:  # Don't include the album itself (already counted)
                    # Check if this other release (single) contains any of our album's tracks
                    shared_isrcs = other_album["tracks"] & album_isrcs_for_release_advance
                    if shared_isrcs:
                        # This single contains some tracks from our album
                        # Add its royalties to this album's royalties for recoupment calculation
                        album["artist_royalties"] += other_album.get("artist_royalties", Decimal("0"))
                        # Mark this single as included in the album (for display)
                        singles_included_in[other_upc] = upc

        # Add track-level advances for tracks in this album
        for isrc in album["tracks"]:
            if isrc and isrc in track_advances:
                album_advance_balance += track_advances[isrc]
                album_cumulative_revenues += cumulative_revenues_by_isrc.get(isrc, Decimal("0"))
                key = f"{upc}_{isrc}"
                album_historical_revenues += historical_revenues_before_period.get(key, Decimal("0"))

        # Calculate recoupable for this album using CUMULATIVE logic
        # already_recouped = min(historical_revenues * artist_share, advance_balance)
        # remaining_advance = advance_balance - already_recouped
        # recoupable_this_period = min(this_period_artist_royalties, remaining_advance)
        album_recoupable = Decimal("0")
        if album_advance_balance > 0:
            # Apply artist share to cumulative revenues for recoupment calculation
            artist_share = Decimal("0.5")  # Default
            contract = None
            if upc in release_contracts:
                contract = release_contracts[upc]
            elif catalog_contract:
                contract = catalog_contract
            if contract:
                artist_share = contract.artist_share

            # What was already recouped before this period
            already_recouped = min(album_historical_revenues * artist_share, album_advance_balance)
            remaining_advance = album_advance_balance - already_recouped

            # What can be recouped this period
            album_recoupable = min(album["artist_royalties"], remaining_advance)
            if album_recoupable < 0:
                album_recoupable = Decimal("0")

            total_scoped_recoupable += album_recoupable

        # Store advance info in album data
        album["advance_balance"] = album_advance_balance
        album["recoupable"] = album_recoupable
        album["net_payable"] = album["artist_royalties"] - album_recoupable

    # Apply catalog advances to remaining royalties after scoped deductions
    remaining_artist_royalties = total_artist - total_scoped_recoupable
    catalog_recoupable = Decimal("0")
    if catalog_balance > 0:
        catalog_recoupable = min(remaining_artist_royalties, catalog_balance)

    # Total advance balance (all scopes) - this is the current balance BEFORE this period's recoupment
    advance_balance = catalog_balance + sum(release_advances.values()) + sum(track_advances.values())
    recoupable = total_scoped_recoupable + catalog_recoupable
    net_payable = total_artist - recoupable

    # Calculate clear advance breakdown for display:
    # - total_advances: sum of all advance entries ever given
    # - total_recouped_before: what was already recouped (from ledger recoupment entries)
    # - recoupable: what is recouped THIS period (calculated above)
    # - remaining_advance: what's left after this period
    total_recouped_before = sum_ledger_recoupments  # Recoupments already recorded in ledger
    remaining_advance = max(Decimal("0"), sum_total_advances - total_recouped_before - recoupable)

    # Build album list with effective shares calculated from actual royalties
    albums = []
    for a in sorted(albums_data.values(), key=lambda x: x["gross"], reverse=True):
        gross = a["gross"]
        upc = a["upc"]
        # Calculate effective share from actual royalties (handles mixed contracts within album)
        if gross > 0:
            effective_artist_share = a["artist_royalties"] / gross
            effective_label_share = a["label_royalties"] / gross
        else:
            effective_artist_share = Decimal("0.5")
            effective_label_share = Decimal("0.5")

        # Check if this single is included in another album's recoupment
        included_in = singles_included_in.get(upc)

        albums.append(AlbumRoyalty(
            release_title=a["release_title"],
            upc=a["upc"],
            track_count=len(a["tracks"]),
            gross=str(gross),
            artist_share=str(effective_artist_share),
            label_share=str(effective_label_share),
            artist_royalties=str(a["artist_royalties"]),
            label_royalties=str(a["label_royalties"]),
            streams=a["streams"],
            advance_balance=str(a.get("advance_balance", Decimal("0"))),
            recoupable=str(a.get("recoupable", Decimal("0"))),
            net_payable=str(a.get("net_payable", a["artist_royalties"])),
            included_in_upc=included_in,
        ))

    # Build sources list
    sources = [
        SourceBreakdown(
            source=s["source"],
            source_label=s["source_label"],
            gross=str(s["gross"]),
            artist_royalties=str(s["artist_royalties"]),
            label_royalties=str(s["label_royalties"]),
            transaction_count=s["transaction_count"],
            streams=s["streams"],
        )
        for s in sorted(sources_data.values(), key=lambda x: x["gross"], reverse=True)
    ]

    return ArtistRoyaltyCalculation(
        artist_id=str(artist_id),
        artist_name=artist.name,
        period_start=period_start,
        period_end=period_end,
        currency="EUR",
        total_gross=str(total_gross),
        total_artist_royalties=str(total_artist),
        total_label_royalties=str(total_label),
        # Clear advance breakdown
        total_advances=str(sum_total_advances),
        total_recouped_before=str(total_recouped_before),
        recoupable=str(recoupable),
        remaining_advance=str(remaining_advance),
        # Legacy
        advance_balance=str(advance_balance),
        net_payable=str(net_payable),
        albums=albums,
        sources=sources,
    )


# Expense report endpoints

class CategoryExpense(PydanticBaseModel):
    """Expense breakdown by category."""
    category: str
    category_label: str
    total_amount: str
    count: int
    currency: str


class ExpenseReport(PydanticBaseModel):
    """Expense report with category breakdown."""
    total_expenses: str
    currency: str
    by_category: List[CategoryExpense]
    entries: List[AdvanceLedgerEntryResponse]


# Category labels for display
CATEGORY_LABELS = {
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
    "pr": "PR / Relations presse",
    "distribution": "Distribution",
    "artwork": "Artwork",
    "cd": "CD",
    "vinyl": "Vinyles",
    "goodies": "Goodies / Merch",
    "other": "Autre",
    None: "Non catégorisé",
}


@router.get("/expenses/report", response_model=ExpenseReport)
async def get_expense_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    artist_id: UUID = None,
    scope: str = None,
    scope_id: str = None,
    category: str = None,
) -> ExpenseReport:
    """
    Get expense report with category breakdown.

    Optional filters:
    - artist_id: Filter by artist
    - scope: Filter by scope ('track', 'release', 'catalog')
    - scope_id: Filter by scope_id (ISRC for track, UPC for release)
    - category: Filter by category

    Returns all ADVANCE entries (not recoupments or payments) grouped by category.
    """
    from sqlalchemy import and_

    # Build query conditions
    conditions = [AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE]

    if artist_id:
        conditions.append(AdvanceLedgerEntry.artist_id == artist_id)
    if scope:
        conditions.append(AdvanceLedgerEntry.scope == scope.lower())
    if scope_id:
        conditions.append(AdvanceLedgerEntry.scope_id == scope_id)
    if category:
        conditions.append(AdvanceLedgerEntry.category == category.lower())

    # Get all matching entries
    result = await db.execute(
        select(AdvanceLedgerEntry)
        .where(and_(*conditions))
        .order_by(AdvanceLedgerEntry.effective_date.desc())
    )
    entries = result.scalars().all()

    # Aggregate by category
    category_totals: dict = {}
    total_expenses = Decimal("0")

    for entry in entries:
        cat = entry.category or None
        if cat not in category_totals:
            category_totals[cat] = {"amount": Decimal("0"), "count": 0}
        category_totals[cat]["amount"] += entry.amount
        category_totals[cat]["count"] += 1
        total_expenses += entry.amount

    # Build category breakdown
    by_category = [
        CategoryExpense(
            category=cat or "uncategorized",
            category_label=CATEGORY_LABELS.get(cat, cat.capitalize() if cat else "Non catégorisé"),
            total_amount=str(data["amount"]),
            count=data["count"],
            currency="EUR",
        )
        for cat, data in sorted(category_totals.items(), key=lambda x: x[1]["amount"], reverse=True)
    ]

    # Build entry responses
    entry_responses = [
        AdvanceLedgerEntryResponse(
            id=entry.id,
            artist_id=entry.artist_id,
            entry_type=entry.entry_type.value,
            amount=entry.amount,
            currency=entry.currency,
            scope=getattr(entry, 'scope', 'catalog') or 'catalog',
            scope_id=getattr(entry, 'scope_id', None),
            category=getattr(entry, 'category', None),
            royalty_run_id=entry.royalty_run_id,
            description=entry.description,
            reference=entry.reference,
            effective_date=entry.effective_date,
            created_at=entry.created_at,
        )
        for entry in entries
    ]

    return ExpenseReport(
        total_expenses=str(total_expenses),
        currency="EUR",
        by_category=by_category,
        entries=entry_responses,
    )


@router.get("/{artist_id}/expenses/report", response_model=ExpenseReport)
async def get_artist_expense_report(
    artist_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    scope: str = None,
    scope_id: str = None,
    category: str = None,
) -> ExpenseReport:
    """
    Get expense report for a specific artist.

    Optional filters:
    - scope: Filter by scope ('track', 'release', 'catalog')
    - scope_id: Filter by scope_id (ISRC for track, UPC for release)
    - category: Filter by category
    """
    # Verify artist exists
    result = await db.execute(
        select(Artist).where(Artist.id == artist_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    # Delegate to the general expense report with artist filter
    return await get_expense_report(
        db=db,
        _token=_token,
        artist_id=artist_id,
        scope=scope,
        scope_id=scope_id,
        category=category,
    )
