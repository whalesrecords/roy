"""
Contracts Router

Handles contract management with multiple parties (artists and labels).
"""

from datetime import date
from typing import Annotated, Optional
from uuid import UUID
import base64

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.config import settings
from app.models import Contract, ContractParty, Artist
from app.schemas.contracts import (
    ContractCreate,
    ContractUpdate,
    ContractResponse,
    ContractListItem,
)

router = APIRouter(prefix="/contracts", tags=["contracts"])


async def verify_admin_token(x_admin_token: Annotated[str, Header()]) -> str:
    """Verify the admin token from header."""
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )
    return x_admin_token


@router.get("", response_model=list[ContractListItem])
async def list_contracts(
    artist_id: Optional[UUID] = None,
    scope: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """
    List all contracts with optional filters.

    Query params:
    - artist_id: Filter by artist
    - scope: Filter by scope (track, release, catalog)
    """
    query = select(Contract).options(selectinload(Contract.parties))

    if artist_id:
        query = query.where(Contract.artist_id == artist_id)

    if scope:
        query = query.where(Contract.scope == scope)

    query = query.order_by(Contract.start_date.desc())

    result = await db.execute(query)
    contracts = result.scalars().all()

    return contracts


@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(
    contract_id: UUID,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """Get a specific contract by ID."""
    query = select(Contract).options(selectinload(Contract.parties)).where(Contract.id == contract_id)
    result = await db.execute(query)
    contract = result.scalar_one_or_none()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contract {contract_id} not found",
        )

    return contract


@router.post("", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
async def create_contract(
    contract_data: ContractCreate,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """
    Create a new contract with multiple parties.

    Validates:
    - Artist exists
    - All party artists exist
    - Shares sum to 100%
    - scope_id is provided for track/release scopes
    """
    # Verify artist exists
    artist_result = await db.execute(
        select(Artist).where(Artist.id == contract_data.artist_id)
    )
    if not artist_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {contract_data.artist_id} not found",
        )

    # Verify all party artists exist
    for party in contract_data.parties:
        if party.party_type == "artist" and party.artist_id:
            party_artist_result = await db.execute(
                select(Artist).where(Artist.id == party.artist_id)
            )
            if not party_artist_result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Artist {party.artist_id} not found for party",
                )

    # Validate scope_id
    if contract_data.scope in ("track", "release") and not contract_data.scope_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"scope_id is required for scope '{contract_data.scope}'",
        )

    if contract_data.scope == "catalog" and contract_data.scope_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scope_id must be null for catalog scope",
        )

    # Collect all artist IDs that need a contract (primary + secondary artists)
    artist_ids_to_create = [contract_data.artist_id]
    for party in contract_data.parties:
        if (
            party.party_type == "artist"
            and party.artist_id
            and party.artist_id != contract_data.artist_id
        ):
            # Check if this secondary artist already has a contract for the same scope/scope_id
            existing = await db.execute(
                select(Contract).where(
                    Contract.artist_id == party.artist_id,
                    Contract.scope == contract_data.scope,
                    Contract.scope_id == contract_data.scope_id if contract_data.scope_id else Contract.scope_id.is_(None),
                )
            )
            if not existing.scalar_one_or_none():
                artist_ids_to_create.append(party.artist_id)

    # Legacy fields - calculate from parties
    artist_share_total = sum(
        p.share_percentage for p in contract_data.parties if p.party_type == "artist"
    )
    label_share_total = sum(
        p.share_percentage for p in contract_data.parties if p.party_type == "label"
    )

    primary_contract = None
    for artist_id in artist_ids_to_create:
        contract = Contract(
            artist_id=artist_id,
            scope=contract_data.scope,
            scope_id=contract_data.scope_id,
            start_date=contract_data.start_date,
            end_date=contract_data.end_date,
            description=contract_data.description,
            artist_share=artist_share_total,
            label_share=label_share_total,
        )

        db.add(contract)
        await db.flush()

        # Create parties (same for all mirror contracts)
        for party_data in contract_data.parties:
            party = ContractParty(
                contract_id=contract.id,
                party_type=party_data.party_type,
                artist_id=party_data.artist_id,
                label_name=party_data.label_name,
                share_percentage=party_data.share_percentage,
                share_physical=party_data.share_physical,
                share_digital=party_data.share_digital,
            )
            db.add(party)

        if primary_contract is None:
            primary_contract = contract

    await db.commit()
    await db.refresh(primary_contract)

    # Load parties
    query = select(Contract).options(selectinload(Contract.parties)).where(Contract.id == primary_contract.id)
    result = await db.execute(query)
    primary_contract = result.scalar_one()

    return primary_contract


@router.put("/{contract_id}", response_model=ContractResponse)
async def update_contract(
    contract_id: UUID,
    contract_data: ContractUpdate,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """
    Update a contract.

    Can update:
    - start_date, end_date, description
    - parties (replaces all parties)
    """
    query = select(Contract).options(selectinload(Contract.parties)).where(Contract.id == contract_id)
    result = await db.execute(query)
    contract = result.scalar_one_or_none()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contract {contract_id} not found",
        )

    # Update basic fields
    if contract_data.start_date is not None:
        contract.start_date = contract_data.start_date

    if contract_data.end_date is not None:
        contract.end_date = contract_data.end_date

    if contract_data.description is not None:
        contract.description = contract_data.description

    # Update parties if provided
    if contract_data.parties is not None:
        # Verify all party artists exist
        for party in contract_data.parties:
            if party.party_type == "artist" and party.artist_id:
                party_artist_result = await db.execute(
                    select(Artist).where(Artist.id == party.artist_id)
                )
                if not party_artist_result.scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Artist {party.artist_id} not found for party",
                    )

        # Delete existing parties
        for party in contract.parties:
            await db.delete(party)

        # Create new parties
        for party_data in contract_data.parties:
            party = ContractParty(
                contract_id=contract.id,
                party_type=party_data.party_type,
                artist_id=party_data.artist_id,
                label_name=party_data.label_name,
                share_percentage=party_data.share_percentage,
                share_physical=party_data.share_physical,
                share_digital=party_data.share_digital,
            )
            db.add(party)

        # Update legacy fields
        contract.artist_share = sum(
            p.share_percentage for p in contract_data.parties if p.party_type == "artist"
        )
        contract.label_share = sum(
            p.share_percentage for p in contract_data.parties if p.party_type == "label"
        )

    await db.commit()
    await db.refresh(contract)

    # Reload with parties
    query = select(Contract).options(selectinload(Contract.parties)).where(Contract.id == contract.id)
    result = await db.execute(query)
    contract = result.scalar_one()

    return contract


@router.delete("/{contract_id}")
async def delete_contract(
    contract_id: UUID,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """Delete a contract."""
    query = select(Contract).where(Contract.id == contract_id)
    result = await db.execute(query)
    contract = result.scalar_one_or_none()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contract {contract_id} not found",
        )

    await db.delete(contract)
    await db.commit()

    return {"success": True, "deleted_id": str(contract_id)}


@router.get("/artist/{artist_id}/active", response_model=list[ContractListItem])
async def get_active_contracts_for_artist(
    artist_id: UUID,
    as_of_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """
    Get all active contracts for an artist.

    Query params:
    - as_of_date: Check contracts active as of this date (default: today)
    """
    if as_of_date is None:
        as_of_date = date.today()

    query = (
        select(Contract)
        .options(selectinload(Contract.parties))
        .where(Contract.artist_id == artist_id)
        .where(Contract.start_date <= as_of_date)
        .where(
            (Contract.end_date.is_(None)) | (Contract.end_date >= as_of_date)
        )
        .order_by(Contract.scope, Contract.start_date.desc())
    )

    result = await db.execute(query)
    contracts = result.scalars().all()

    return contracts


@router.post("/{contract_id}/document")
async def upload_contract_document(
    contract_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
) -> dict:
    """Upload a PDF document for a contract."""
    # Validate file type
    if not file.content_type or not file.content_type.startswith("application/pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed",
        )

    # Get the contract
    result = await db.execute(
        select(Contract).where(Contract.id == contract_id)
    )
    contract = result.scalar_one_or_none()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found",
        )

    # Read file content
    content = await file.read()

    # Store as base64 data URL (for small files)
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB",
        )

    # Create data URL
    base64_content = base64.b64encode(content).decode('utf-8')
    document_url = f"data:application/pdf;base64,{base64_content}"

    # Update the contract
    contract.document_url = document_url
    await db.commit()

    return {
        "success": True,
        "contract_id": str(contract_id),
    }


@router.delete("/{contract_id}/document")
async def delete_contract_document(
    contract_id: UUID,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
) -> dict:
    """Delete the document attached to a contract."""
    result = await db.execute(
        select(Contract).where(Contract.id == contract_id)
    )
    contract = result.scalar_one_or_none()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found",
        )

    contract.document_url = None
    await db.commit()

    return {"success": True, "contract_id": str(contract_id)}
