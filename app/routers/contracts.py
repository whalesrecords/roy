"""
Contracts Router

Handles contract management with multiple parties (artists and labels).
"""

import base64
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.tenancy import LabelContext, apply_label_scope, get_label_context
from app.core.database import get_db
from app.models import Artist, Contract, ContractParty
from app.models.artwork import ReleaseArtwork, TrackArtwork
from app.models.contract_track_contributor import ContractTrackContributor
from app.schemas.contracts import (
    ContractCreate,
    ContractListItem,
    ContractResponse,
    ContractUpdate,
    ContributorsResponse,
    SetContributorsRequest,
)


async def _attach_scope_titles(db: AsyncSession, contracts: list[Contract]) -> None:
    """Resolve and attach the album (UPC) / track (ISRC) name on each contract."""
    upcs = [c.scope_id for c in contracts if c.scope == "release" and c.scope_id]
    isrcs = [c.scope_id for c in contracts if c.scope == "track" and c.scope_id]
    rel: dict[str, str] = {}
    trk: dict[str, str] = {}
    if upcs:
        r = await db.execute(select(ReleaseArtwork.upc, ReleaseArtwork.name).where(ReleaseArtwork.upc.in_(upcs)))
        rel = {row.upc: row.name for row in r.all()}
    if isrcs:
        r = await db.execute(select(TrackArtwork.isrc, TrackArtwork.name).where(TrackArtwork.isrc.in_(isrcs)))
        trk = {row.isrc: row.name for row in r.all()}
    for c in contracts:
        if c.scope == "release" and c.scope_id:
            c.scope_title = rel.get(c.scope_id, c.scope_id)
        elif c.scope == "track" and c.scope_id:
            c.scope_title = trk.get(c.scope_id, c.scope_id)
        else:
            c.scope_title = None

router = APIRouter(prefix="/contracts", tags=["contracts"])


async def _get_scoped_contract_or_404(db: AsyncSession, contract_id: UUID, ctx: LabelContext) -> Contract:
    """Fetch a contract only if it belongs to a label the caller may access."""
    stmt = apply_label_scope(select(Contract).where(Contract.id == contract_id), Contract.label_id, ctx)
    contract = (await db.execute(stmt)).scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    return contract


@router.get("", response_model=list[ContractListItem])
async def list_contracts(
    artist_id: Optional[UUID] = None,
    scope: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    ctx: LabelContext = Depends(get_label_context),
):
    """
    List all contracts with optional filters.

    Query params:
    - artist_id: Filter by artist
    - scope: Filter by scope (track, release, catalog)
    """
    query = apply_label_scope(
        select(Contract).options(selectinload(Contract.parties)), Contract.label_id, ctx
    )

    if artist_id:
        query = query.where(Contract.artist_id == artist_id)

    if scope:
        query = query.where(Contract.scope == scope)

    query = query.order_by(Contract.start_date.desc())

    result = await db.execute(query)
    contracts = list(result.scalars().all())
    await _attach_scope_titles(db, contracts)

    return contracts


@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(
    contract_id: UUID,
    db: AsyncSession = Depends(get_db),
    ctx: LabelContext = Depends(get_label_context),
):
    """Get a specific contract by ID."""
    query = apply_label_scope(
        select(Contract).options(selectinload(Contract.parties)).where(Contract.id == contract_id),
        Contract.label_id, ctx,
    )
    result = await db.execute(query)
    contract = result.scalar_one_or_none()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contract {contract_id} not found",
        )

    await _attach_scope_titles(db, [contract])
    return contract


@router.get("/{contract_id}/contributors", response_model=ContributorsResponse)
async def get_contract_contributors(
    contract_id: UUID,
    db: AsyncSession = Depends(get_db),
    ctx: LabelContext = Depends(get_label_context),
):
    """List the per-track contributors recorded on a contract."""
    await _get_scoped_contract_or_404(db, contract_id, ctx)
    result = await db.execute(
        select(ContractTrackContributor)
        .where(ContractTrackContributor.contract_id == contract_id)
        .order_by(ContractTrackContributor.isrc, ContractTrackContributor.created_at)
    )
    return ContributorsResponse(contributors=list(result.scalars().all()))


@router.put("/{contract_id}/contributors", response_model=ContributorsResponse)
async def set_contract_contributors(
    contract_id: UUID,
    payload: SetContributorsRequest,
    db: AsyncSession = Depends(get_db),
    ctx: LabelContext = Depends(get_label_context),
):
    """Replace the full set of per-track contributors for a contract."""
    contract = await _get_scoped_contract_or_404(db, contract_id, ctx)

    # Replace-all: clear then re-insert.
    existing = await db.execute(
        select(ContractTrackContributor).where(ContractTrackContributor.contract_id == contract_id)
    )
    for row in existing.scalars().all():
        await db.delete(row)

    for c in payload.contributors:
        name = (c.contributor_name or "").strip()
        if not name:
            continue
        db.add(ContractTrackContributor(
            contract_id=contract_id,
            label_id=contract.label_id,
            isrc=(c.isrc or None),
            track_title=(c.track_title or None),
            contributor_name=name,
            role=(c.role or None),
            percentage=c.percentage,
        ))
    await db.commit()

    result = await db.execute(
        select(ContractTrackContributor)
        .where(ContractTrackContributor.contract_id == contract_id)
        .order_by(ContractTrackContributor.isrc, ContractTrackContributor.created_at)
    )
    return ContributorsResponse(contributors=list(result.scalars().all()))


@router.post("", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
async def create_contract(
    contract_data: ContractCreate,
    db: AsyncSession = Depends(get_db),
    ctx: LabelContext = Depends(get_label_context),
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

    # Label to own the new rows (selected/sole/home label; Whales for platform).
    write_label = ctx.write_label_id()

    # Check for duplicate contract (same label + artist + scope + scope_id)
    duplicate_condition = [
        Contract.label_id == write_label,
        Contract.artist_id == contract_data.artist_id,
        Contract.scope == contract_data.scope,
    ]
    if contract_data.scope_id:
        duplicate_condition.append(Contract.scope_id == contract_data.scope_id)
    else:
        duplicate_condition.append(Contract.scope_id.is_(None))

    existing_result = await db.execute(
        select(Contract).where(*duplicate_condition)
    )
    if existing_result.scalar_one_or_none():
        scope_label = {
            "track": f"track (ISRC: {contract_data.scope_id})",
            "release": f"release (UPC: {contract_data.scope_id})",
            "catalog": "catalogue",
        }.get(contract_data.scope, contract_data.scope)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Un contrat existe déjà pour cet artiste sur ce {scope_label}. Modifiez le contrat existant.",
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
                    Contract.label_id == write_label,
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
            label_id=write_label,
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
                label_id=write_label,
                party_type=party_data.party_type,
                artist_id=party_data.artist_id,
                label_name=party_data.label_name,
                share_percentage=party_data.share_percentage,
                share_physical=party_data.share_physical,
                share_digital=party_data.share_digital,
                contact_email=getattr(party_data, 'contact_email', None),
                contact_phone=getattr(party_data, 'contact_phone', None),
            )
            db.add(party)

        if primary_contract is None:
            primary_contract = contract

    await db.commit()
    await db.refresh(primary_contract)

    # Notify the artist there's a new contract awaiting their signature.
    # Best-effort: a notification/push failure must never break contract creation.
    try:
        import json as _json

        from app.models.artist_notification import ArtistNotification, ArtistNotificationType
        from app.services.push import send_artist_push

        db.add(ArtistNotification(
            artist_id=contract_data.artist_id,
            notification_type=ArtistNotificationType.CONTRACT_TO_SIGN.value,
            title="Nouveau contrat à signer",
            message="Un nouveau contrat vous attend dans votre espace.",
            link="/contracts",
            data=_json.dumps({"contract_id": str(primary_contract.id)}),
        ))
        await db.commit()
        await send_artist_push(
            db,
            contract_data.artist_id,
            "Nouveau contrat à signer",
            "Un nouveau contrat vous attend dans votre espace.",
            {"type": "contract_to_sign", "link": "/contracts"},
        )
    except Exception:  # noqa: BLE001 — notification is best-effort
        pass

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
    ctx: LabelContext = Depends(get_label_context),
):
    """
    Update a contract.

    Can update:
    - start_date, end_date, description
    - parties (replaces all parties)
    """
    query = apply_label_scope(
        select(Contract).options(selectinload(Contract.parties)).where(Contract.id == contract_id),
        Contract.label_id, ctx,
    )
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
                label_id=contract.label_id,
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
    ctx: LabelContext = Depends(get_label_context),
):
    """Delete a contract."""
    contract = await _get_scoped_contract_or_404(db, contract_id, ctx)

    await db.delete(contract)
    await db.commit()

    return {"success": True, "deleted_id": str(contract_id)}


@router.get("/artist/{artist_id}/active", response_model=list[ContractListItem])
async def get_active_contracts_for_artist(
    artist_id: UUID,
    as_of_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    ctx: LabelContext = Depends(get_label_context),
):
    """
    Get all active contracts for an artist.

    Query params:
    - as_of_date: Check contracts active as of this date (default: today)
    """
    if as_of_date is None:
        as_of_date = date.today()

    query = apply_label_scope(
        select(Contract)
        .options(selectinload(Contract.parties))
        .where(Contract.artist_id == artist_id)
        .where(Contract.start_date <= as_of_date)
        .where(
            (Contract.end_date.is_(None)) | (Contract.end_date >= as_of_date)
        )
        .order_by(Contract.scope, Contract.start_date.desc()),
        Contract.label_id, ctx,
    )

    result = await db.execute(query)
    contracts = result.scalars().all()

    return contracts


@router.post("/{contract_id}/document")
async def upload_contract_document(
    contract_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    ctx: LabelContext = Depends(get_label_context),
) -> dict:
    """Upload a PDF document for a contract."""
    # Validate file type
    if not file.content_type or not file.content_type.startswith("application/pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed",
        )

    # Get the contract (label-scoped)
    contract = await _get_scoped_contract_or_404(db, contract_id, ctx)

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
    ctx: LabelContext = Depends(get_label_context),
) -> dict:
    """Delete the document attached to a contract."""
    contract = await _get_scoped_contract_or_404(db, contract_id, ctx)

    contract.document_url = None
    await db.commit()

    return {"success": True, "contract_id": str(contract_id)}
