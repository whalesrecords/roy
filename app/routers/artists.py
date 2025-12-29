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
)

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

    entry = AdvanceLedgerEntry(
        artist_id=artist_id,
        entry_type=LedgerEntryType.ADVANCE,
        amount=data.amount,
        currency=data.currency,
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
            royalty_run_id=entry.royalty_run_id,
            description=entry.description,
            reference=entry.reference,
            effective_date=entry.effective_date,
            created_at=entry.created_at,
        )
        for entry in entries
    ]


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
        currency="USD",  # TODO: support multiple currencies
    )
