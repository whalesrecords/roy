"""
Royalties Router

Handles royalty runs, calculations, and statements.
"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.models.royalty_run import RoyaltyRun
from app.models.statement import Statement
from app.models.artist import Artist
from app.schemas.royalties import (
    RoyaltyRunCreate,
    RoyaltyRunResponse,
    ArtistRoyaltyResult,
    StatementResponse,
    StatementsListResponse,
)
from app.services.calculator import calculator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/royalty-runs", tags=["royalties"])


async def verify_admin_token(x_admin_token: Annotated[str, Header()]) -> str:
    """Verify the admin token from header."""
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )
    return x_admin_token


@router.get("", response_model=list[RoyaltyRunResponse])
async def list_royalty_runs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> list[RoyaltyRunResponse]:
    """List all royalty runs, ordered by creation date descending."""
    result = await db.execute(
        select(RoyaltyRun)
        .options(selectinload(RoyaltyRun.statements))
        .order_by(RoyaltyRun.created_at.desc())
    )
    runs = result.scalars().all()

    # Pre-load all artists for name lookup
    artist_ids = set()
    for run in runs:
        for stmt in run.statements:
            artist_ids.add(stmt.artist_id)

    artist_names = {}
    if artist_ids:
        artists_result = await db.execute(
            select(Artist).where(Artist.id.in_(artist_ids))
        )
        for artist in artists_result.scalars().all():
            artist_names[artist.id] = artist.name

    responses = []
    for run in runs:
        artists = [
            ArtistRoyaltyResult(
                artist_id=stmt.artist_id,
                artist_name=artist_names.get(stmt.artist_id, "Inconnu"),
                gross=stmt.gross_revenue,
                artist_royalties=stmt.artist_royalties,
                recouped=stmt.recouped,
                net_payable=stmt.net_payable,
                transaction_count=stmt.transaction_count,
            )
            for stmt in run.statements
        ]
        responses.append(RoyaltyRunResponse(
            run_id=run.id,
            period_start=run.period_start,
            period_end=run.period_end,
            base_currency=run.base_currency,
            status=run.status.value,
            is_locked=run.is_locked,
            total_transactions=run.total_transactions,
            total_gross=run.total_gross,
            total_artist_royalties=run.total_artist_royalties,
            total_label_royalties=run.total_label_royalties,
            total_recouped=run.total_recouped,
            total_net_payable=run.total_net_payable,
            artists=artists,
            import_ids=run.import_ids or [],
            created_at=run.created_at,
            completed_at=run.completed_at,
            locked_at=run.locked_at,
        ))

    return responses


@router.post("", response_model=RoyaltyRunResponse)
async def create_royalty_run(
    data: RoyaltyRunCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> RoyaltyRunResponse:
    """
    Create and execute a new royalty calculation run.

    Processes all transactions in the specified period:
    1. Finds applicable contracts for each transaction
    2. Calculates artist and label shares
    3. Handles advance recoupment
    4. Creates statements for each artist

    Args:
        data: Period and currency parameters

    Returns:
        Royalty run results with per-artist breakdown
    """
    # Validate period
    if data.period_end < data.period_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="period_end must be >= period_start",
        )

    try:
        result = await calculator.calculate_run(
            db=db,
            period_start=data.period_start,
            period_end=data.period_end,
            base_currency=data.base_currency,
            artist_ids=data.artist_ids,
        )

        # Get the run for response
        run = await calculator.get_run(db, result.run_id)

        # Build artist results list
        artists = [
            ArtistRoyaltyResult(
                artist_id=ar.artist_id,
                artist_name=ar.artist_name,
                gross=ar.gross,
                artist_royalties=ar.artist_royalties,
                recouped=ar.recouped,
                net_payable=ar.net_payable,
                transaction_count=ar.transaction_count,
            )
            for ar in result.artists.values()
        ]

        return RoyaltyRunResponse(
            run_id=run.id,
            period_start=run.period_start,
            period_end=run.period_end,
            base_currency=run.base_currency,
            status=run.status.value,
            is_locked=run.is_locked,
            total_transactions=run.total_transactions,
            total_gross=run.total_gross,
            total_artist_royalties=run.total_artist_royalties,
            total_label_royalties=run.total_label_royalties,
            total_recouped=run.total_recouped,
            total_net_payable=run.total_net_payable,
            artists=artists,
            import_ids=run.import_ids or [],
            created_at=run.created_at,
            completed_at=run.completed_at,
            locked_at=run.locked_at,
        )

    except Exception as e:
        logger.error(f"Royalty run failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Royalty calculation failed: {str(e)}",
        )


@router.get("/{run_id}", response_model=RoyaltyRunResponse)
async def get_royalty_run(
    run_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> RoyaltyRunResponse:
    """
    Get a royalty run by ID.

    Returns:
        Royalty run with all details
    """
    run = await calculator.get_run(db, run_id)

    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Royalty run {run_id} not found",
        )

    # Load artist names
    artist_ids = [stmt.artist_id for stmt in run.statements]
    artist_names = {}
    if artist_ids:
        artists_result = await db.execute(
            select(Artist).where(Artist.id.in_(artist_ids))
        )
        for artist in artists_result.scalars().all():
            artist_names[artist.id] = artist.name

    # Build artist results from statements
    artists = [
        ArtistRoyaltyResult(
            artist_id=stmt.artist_id,
            artist_name=artist_names.get(stmt.artist_id, "Inconnu"),
            gross=stmt.gross_revenue,
            artist_royalties=stmt.artist_royalties,
            recouped=stmt.recouped,
            net_payable=stmt.net_payable,
            transaction_count=stmt.transaction_count,
        )
        for stmt in run.statements
    ]

    return RoyaltyRunResponse(
        run_id=run.id,
        period_start=run.period_start,
        period_end=run.period_end,
        base_currency=run.base_currency,
        status=run.status.value,
        is_locked=run.is_locked,
        total_transactions=run.total_transactions,
        total_gross=run.total_gross,
        total_artist_royalties=run.total_artist_royalties,
        total_label_royalties=run.total_label_royalties,
        total_recouped=run.total_recouped,
        total_net_payable=run.total_net_payable,
        artists=artists,
        import_ids=run.import_ids or [],
        created_at=run.created_at,
        completed_at=run.completed_at,
        locked_at=run.locked_at,
    )


@router.post("/{run_id}/lock", response_model=RoyaltyRunResponse)
async def lock_royalty_run(
    run_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> RoyaltyRunResponse:
    """
    Lock a royalty run, preventing further modifications.

    Also finalizes all statements for the run.

    Returns:
        Updated royalty run
    """
    try:
        run = await calculator.lock_run(db, run_id)

        # Load artist names
        artist_ids = [stmt.artist_id for stmt in run.statements]
        artist_names = {}
        if artist_ids:
            artists_result = await db.execute(
                select(Artist).where(Artist.id.in_(artist_ids))
            )
            for artist in artists_result.scalars().all():
                artist_names[artist.id] = artist.name

        # Build artist results from statements
        artists = [
            ArtistRoyaltyResult(
                artist_id=stmt.artist_id,
                artist_name=artist_names.get(stmt.artist_id, "Inconnu"),
                gross=stmt.gross_revenue,
                artist_royalties=stmt.artist_royalties,
                recouped=stmt.recouped,
                net_payable=stmt.net_payable,
                transaction_count=stmt.transaction_count,
            )
            for stmt in run.statements
        ]

        return RoyaltyRunResponse(
            run_id=run.id,
            period_start=run.period_start,
            period_end=run.period_end,
            base_currency=run.base_currency,
            status=run.status.value,
            is_locked=run.is_locked,
            total_transactions=run.total_transactions,
            total_gross=run.total_gross,
            total_artist_royalties=run.total_artist_royalties,
            total_label_royalties=run.total_label_royalties,
            total_recouped=run.total_recouped,
            total_net_payable=run.total_net_payable,
            artists=artists,
            import_ids=run.import_ids or [],
            created_at=run.created_at,
            completed_at=run.completed_at,
            locked_at=run.locked_at,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{run_id}")
async def delete_royalty_run(
    run_id: UUID,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
) -> dict:
    """
    Delete a royalty run and all associated statements.

    Args:
        run_id: The ID of the royalty run to delete
        force: If True, allows deletion of locked runs

    Warning: This action is irreversible.

    Returns:
        Success confirmation with deleted run ID
    """
    # Get the run
    result = await db.execute(
        select(RoyaltyRun).where(RoyaltyRun.id == run_id)
    )
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Royalty run {run_id} not found",
        )

    if run.is_locked and not force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a locked royalty run. Use force=true to override.",
        )

    # Delete statements first (cascade should handle this, but be explicit)
    await db.execute(
        select(Statement).where(Statement.royalty_run_id == run_id)
    )
    from sqlalchemy import delete
    await db.execute(delete(Statement).where(Statement.royalty_run_id == run_id))

    # Delete the run
    await db.delete(run)
    await db.flush()

    return {"success": True, "deleted_id": str(run_id)}


# Artists router (separate prefix)
artists_router = APIRouter(prefix="/artists", tags=["artists"])


@artists_router.get("/{artist_id}/statements", response_model=StatementsListResponse)
async def get_artist_statements(
    artist_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> StatementsListResponse:
    """
    Get all statements for an artist.

    Returns statement history ordered by period (newest first).
    """
    # Verify artist exists
    result = await db.execute(
        select(Artist).where(Artist.id == artist_id)
    )
    artist = result.scalar_one_or_none()

    if artist is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist {artist_id} not found",
        )

    # Get statements
    statements = await calculator.get_artist_statements(db, artist_id)

    return StatementsListResponse(
        artist_id=artist_id,
        statements=[
            StatementResponse(
                id=stmt.id,
                artist_id=stmt.artist_id,
                royalty_run_id=stmt.royalty_run_id,
                period_start=stmt.period_start,
                period_end=stmt.period_end,
                currency=stmt.currency,
                status=stmt.status.value,
                gross_revenue=stmt.gross_revenue,
                artist_royalties=stmt.artist_royalties,
                label_royalties=stmt.label_royalties,
                advance_balance_before=stmt.advance_balance_before,
                recouped=stmt.recouped,
                advance_balance_after=stmt.advance_balance_after,
                net_payable=stmt.net_payable,
                transaction_count=stmt.transaction_count,
                created_at=stmt.created_at,
                finalized_at=stmt.finalized_at,
                paid_at=stmt.paid_at,
            )
            for stmt in statements
        ],
        total_count=len(statements),
    )
