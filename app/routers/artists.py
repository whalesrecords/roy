"""
Artists Router

Handles artist management, contracts, and advances.
"""

import logging
from decimal import Decimal
from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.artist import Artist
from app.models.contract import Contract, ContractScope
from app.models.advance_ledger import AdvanceLedgerEntry, LedgerEntryType
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
            external_id=artist.external_id,
            spotify_id=artist.spotify_id,
            image_url=artist.image_url,
            image_url_small=artist.image_url_small,
            created_at=artist.created_at,
        )
        for artist in artists
    ]


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
        external_id=artist.external_id,
        spotify_id=artist.spotify_id,
        image_url=artist.image_url,
        image_url_small=artist.image_url_small,
        created_at=artist.created_at,
    )


from pydantic import BaseModel as PydanticBaseModel

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

    # Only allow updating advances, not recoupments
    if entry.entry_type != LedgerEntryType.ADVANCE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only advances can be updated, not recoupments",
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

    # Only allow deleting advances, not recoupments
    if entry.entry_type != LedgerEntryType.ADVANCE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only advances can be deleted, not recoupments",
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
    advance_balance: str
    recoupable: str
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
                "release_title": tx.release_title or "Single",
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

    # Get advance balance
    advance_result = await db.execute(
        select(func.coalesce(func.sum(AdvanceLedgerEntry.amount), 0)).where(
            AdvanceLedgerEntry.artist_id == artist_id,
            AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE,
        )
    )
    total_advances = Decimal(str(advance_result.scalar()))

    recoup_result = await db.execute(
        select(func.coalesce(func.sum(AdvanceLedgerEntry.amount), 0)).where(
            AdvanceLedgerEntry.artist_id == artist_id,
            AdvanceLedgerEntry.entry_type == LedgerEntryType.RECOUPMENT,
        )
    )
    total_recouped = Decimal(str(recoup_result.scalar()))

    advance_balance = total_advances - total_recouped
    recoupable = min(total_artist, advance_balance) if advance_balance > 0 else Decimal("0")
    net_payable = total_artist - recoupable

    # Build album list with effective shares calculated from actual royalties
    albums = []
    for a in sorted(albums_data.values(), key=lambda x: x["gross"], reverse=True):
        gross = a["gross"]
        # Calculate effective share from actual royalties (handles mixed contracts within album)
        if gross > 0:
            effective_artist_share = a["artist_royalties"] / gross
            effective_label_share = a["label_royalties"] / gross
        else:
            effective_artist_share = Decimal("0.5")
            effective_label_share = Decimal("0.5")

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
        advance_balance=str(advance_balance),
        recoupable=str(recoupable),
        net_payable=str(net_payable),
        albums=albums,
        sources=sources,
    )
