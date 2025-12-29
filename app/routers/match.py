"""
Match Router

Endpoints for transaction matching/correlation system.
Allows matching transactions to canonical entities (artists, releases, tracks).
"""

import logging
from datetime import date
from typing import Annotated, Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.services.matching import (
    run_auto_matching,
    get_unresolved_suggestions,
    resolve_suggestion,
    get_matching_stats,
    MatchResult,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/match", tags=["matching"])


async def verify_admin_token(x_admin_token: Annotated[str, Header()]) -> str:
    """Verify the admin token from header."""
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )
    return x_admin_token


# --- Schemas ---

class AutoMatchRequest(BaseModel):
    """Request to run auto-matching."""
    import_id: Optional[UUID] = Field(None, description="Filter by import ID")
    period_start: Optional[date] = Field(None, description="Filter by period start")
    period_end: Optional[date] = Field(None, description="Filter by period end")


class AutoMatchResponse(BaseModel):
    """Response from auto-matching."""
    processed: int = Field(description="Total transactions processed")
    hard_matched: int = Field(description="Transactions matched by ISRC/UPC/exact name")
    auto_accepted: int = Field(description="Fuzzy matches auto-accepted (high confidence)")
    pending: int = Field(description="Fuzzy matches pending review")
    still_unmatched: int = Field(description="Transactions with no match found")


class SuggestionDetail(BaseModel):
    """A single match suggestion."""
    suggestion_id: str
    candidate_artist_id: Optional[str]
    candidate_artist_name: Optional[str]
    score: int
    method: str


class UnresolvedTransaction(BaseModel):
    """Transaction with pending match suggestions."""
    transaction_id: str
    artist_name: Optional[str]
    track_title: Optional[str]
    release_title: Optional[str]
    isrc: Optional[str]
    upc: Optional[str]
    gross_amount: str
    sale_type: str
    store_name: Optional[str]
    suggestions: List[SuggestionDetail]


class ResolveRequest(BaseModel):
    """Request to resolve a match suggestion."""
    suggestion_id: UUID = Field(description="ID of the suggestion to resolve")
    action: str = Field(description="Action: 'accept' or 'reject'")


class ResolveResponse(BaseModel):
    """Response from resolving a suggestion."""
    success: bool
    action: str
    transaction_id: Optional[str] = None
    artist_id: Optional[str] = None
    suggestion_id: Optional[str] = None


class MatchingStats(BaseModel):
    """Statistics about matching status."""
    total_transactions: int
    matched: int
    unmatched: int
    pending_review: int
    match_rate: float


# --- Endpoints ---

@router.post("/auto-run", response_model=AutoMatchResponse)
async def auto_run_matching(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    request: AutoMatchRequest = AutoMatchRequest(),
) -> AutoMatchResponse:
    """
    Run automatic matching on transactions.

    Generates suggestions and auto-accepts high confidence matches.
    Returns counts of processed, matched, pending, and unmatched transactions.
    """
    try:
        result = await run_auto_matching(
            db=db,
            import_id=request.import_id,
            period_start=request.period_start,
            period_end=request.period_end,
        )
        await db.commit()

        return AutoMatchResponse(
            processed=result.processed,
            hard_matched=result.hard_matched,
            auto_accepted=result.auto_accepted,
            pending=result.pending,
            still_unmatched=result.still_unmatched,
        )
    except Exception as e:
        logger.error(f"Error running auto-matching: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/unresolved", response_model=List[UnresolvedTransaction])
async def get_unresolved(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    import_id: Optional[UUID] = Query(None, description="Filter by import ID"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> List[UnresolvedTransaction]:
    """
    Get pending match suggestions grouped by transaction.

    Returns transactions with their candidate matches for manual review.
    """
    suggestions = await get_unresolved_suggestions(
        db=db,
        import_id=import_id,
        limit=limit,
        offset=offset,
    )

    return [
        UnresolvedTransaction(
            transaction_id=s['transaction_id'],
            artist_name=s['artist_name'],
            track_title=s['track_title'],
            release_title=s['release_title'],
            isrc=s['isrc'],
            upc=s['upc'],
            gross_amount=s['gross_amount'],
            sale_type=s['sale_type'],
            store_name=s['store_name'],
            suggestions=[
                SuggestionDetail(
                    suggestion_id=sg['suggestion_id'],
                    candidate_artist_id=sg['candidate_artist_id'],
                    candidate_artist_name=sg['candidate_artist_name'],
                    score=sg['score'],
                    method=sg['method'],
                )
                for sg in s['suggestions']
            ],
        )
        for s in suggestions
    ]


@router.post("/resolve", response_model=ResolveResponse)
async def resolve_match(
    request: ResolveRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ResolveResponse:
    """
    Resolve a match suggestion by accepting or rejecting it.

    If accepted:
    - Applies the match to the transaction (sets artist_id/release_id/track_id)
    - Rejects other pending suggestions for the same transaction

    If rejected:
    - Just marks the suggestion as rejected
    """
    if request.action not in ['accept', 'reject']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action must be 'accept' or 'reject'",
        )

    try:
        result = await resolve_suggestion(
            db=db,
            suggestion_id=request.suggestion_id,
            action=request.action,
            resolved_by="user",
        )
        await db.commit()

        return ResolveResponse(
            success=result['success'],
            action=result['action'],
            transaction_id=result.get('transaction_id'),
            artist_id=result.get('artist_id'),
            suggestion_id=result.get('suggestion_id'),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error resolving suggestion: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/stats", response_model=MatchingStats)
async def get_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    import_id: Optional[UUID] = Query(None, description="Filter by import ID"),
) -> MatchingStats:
    """Get statistics about matching status."""
    stats = await get_matching_stats(db=db, import_id=import_id)
    return MatchingStats(**stats)
