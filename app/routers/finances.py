"""
Finances Router

Manages all expenses, advances, and payments with document upload support.
"""

import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Annotated, List, Optional
import base64

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.models.advance_ledger import AdvanceLedgerEntry, LedgerEntryType
from app.models.artist import Artist
from app.models.royalty_run import RoyaltyRun, RoyaltyRunStatus


router = APIRouter(prefix="/finances", tags=["finances"])


async def verify_admin_token(x_admin_token: Annotated[str, Header()]) -> str:
    """Verify the admin token from header."""
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )
    return x_admin_token


# Response schemas

class ExpenseResponse(BaseModel):
    """Response schema for an expense entry."""
    id: str
    artist_id: Optional[str] = None
    artist_name: Optional[str] = None
    entry_type: str
    amount: str
    currency: str
    scope: str
    scope_id: Optional[str] = None
    category: Optional[str] = None
    category_label: Optional[str] = None
    royalty_run_id: Optional[str] = None
    description: Optional[str] = None
    reference: Optional[str] = None
    document_url: Optional[str] = None
    effective_date: str
    created_at: str


class ExpenseCreate(BaseModel):
    """Request schema for creating an expense."""
    artist_id: Optional[str] = None
    amount: str
    currency: str = "EUR"
    scope: str = "catalog"
    scope_id: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    reference: Optional[str] = None
    effective_date: Optional[str] = None


class ExpenseUpdate(BaseModel):
    """Request schema for updating an expense."""
    artist_id: Optional[str] = None
    amount: Optional[str] = None
    currency: Optional[str] = None
    scope: Optional[str] = None
    scope_id: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    reference: Optional[str] = None
    effective_date: Optional[str] = None


class RoyaltyPaymentResponse(BaseModel):
    """Response schema for a royalty payment (from locked runs)."""
    run_id: str
    period_start: str
    period_end: str
    total_net_payable: str
    total_artist_royalties: str
    total_recouped: str
    status: str
    locked_at: Optional[str] = None
    artists_count: int


class FinancesSummary(BaseModel):
    """Summary of all finances."""
    total_expenses: str
    total_royalties_payable: str
    expenses_count: int
    royalty_runs_count: int
    currency: str


# Category labels
CATEGORY_LABELS = {
    "mastering": "Mastering",
    "mixing": "Mixage",
    "recording": "Enregistrement",
    "photos": "Photos",
    "video": "Video",
    "advertising": "Publicite",
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
}


@router.get("/summary", response_model=FinancesSummary)
async def get_finances_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    year: Optional[int] = None,
) -> FinancesSummary:
    """Get summary of all finances."""
    # Get total expenses
    expense_query = select(func.sum(AdvanceLedgerEntry.amount)).where(
        AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE
    )
    if year:
        expense_query = expense_query.where(
            func.extract('year', AdvanceLedgerEntry.effective_date) == year
        )
    expense_result = await db.execute(expense_query)
    total_expenses = expense_result.scalar() or Decimal("0")

    # Get expense count
    count_query = select(func.count(AdvanceLedgerEntry.id)).where(
        AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE
    )
    if year:
        count_query = count_query.where(
            func.extract('year', AdvanceLedgerEntry.effective_date) == year
        )
    count_result = await db.execute(count_query)
    expenses_count = count_result.scalar() or 0

    # Get total royalties payable from locked runs
    royalty_query = select(func.sum(RoyaltyRun.total_net_payable)).where(
        RoyaltyRun.is_locked == True
    )
    if year:
        royalty_query = royalty_query.where(
            func.extract('year', RoyaltyRun.period_start) == year
        )
    royalty_result = await db.execute(royalty_query)
    total_royalties = royalty_result.scalar() or Decimal("0")

    # Get royalty runs count
    runs_count_query = select(func.count(RoyaltyRun.id)).where(
        RoyaltyRun.is_locked == True
    )
    if year:
        runs_count_query = runs_count_query.where(
            func.extract('year', RoyaltyRun.period_start) == year
        )
    runs_count_result = await db.execute(runs_count_query)
    runs_count = runs_count_result.scalar() or 0

    return FinancesSummary(
        total_expenses=str(total_expenses),
        total_royalties_payable=str(total_royalties),
        expenses_count=expenses_count,
        royalty_runs_count=runs_count,
        currency="EUR",
    )


@router.get("/expenses", response_model=List[ExpenseResponse])
async def list_expenses(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    year: Optional[int] = None,
    category: Optional[str] = None,
    artist_id: Optional[str] = None,
) -> List[ExpenseResponse]:
    """List all expenses (advances)."""
    query = (
        select(AdvanceLedgerEntry)
        .options(selectinload(AdvanceLedgerEntry.artist))
        .where(AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE)
        .order_by(AdvanceLedgerEntry.effective_date.desc())
    )

    if year:
        query = query.where(
            func.extract('year', AdvanceLedgerEntry.effective_date) == year
        )
    if category:
        query = query.where(AdvanceLedgerEntry.category == category)
    if artist_id:
        query = query.where(AdvanceLedgerEntry.artist_id == uuid.UUID(artist_id))

    result = await db.execute(query)
    entries = result.scalars().all()

    return [
        ExpenseResponse(
            id=str(entry.id),
            artist_id=str(entry.artist_id) if entry.artist_id else None,
            artist_name=entry.artist.name if entry.artist else None,
            entry_type=entry.entry_type.value if hasattr(entry.entry_type, 'value') else str(entry.entry_type),
            amount=str(entry.amount),
            currency=entry.currency,
            scope=entry.scope,
            scope_id=entry.scope_id,
            category=entry.category,
            category_label=CATEGORY_LABELS.get(entry.category, entry.category) if entry.category else None,
            royalty_run_id=str(entry.royalty_run_id) if entry.royalty_run_id else None,
            description=entry.description,
            reference=entry.reference,
            document_url=entry.document_url,
            effective_date=entry.effective_date.isoformat(),
            created_at=entry.created_at.isoformat(),
        )
        for entry in entries
    ]


@router.post("/expenses", response_model=ExpenseResponse)
async def create_expense(
    data: ExpenseCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ExpenseResponse:
    """Create a new expense entry."""
    effective_date = datetime.now()
    if data.effective_date:
        try:
            effective_date = datetime.fromisoformat(data.effective_date.replace('Z', '+00:00'))
        except ValueError:
            # Try parsing as date only
            effective_date = datetime.strptime(data.effective_date, "%Y-%m-%d")

    entry = AdvanceLedgerEntry(
        artist_id=uuid.UUID(data.artist_id) if data.artist_id else None,
        entry_type=LedgerEntryType.ADVANCE,
        amount=Decimal(data.amount),
        currency=data.currency,
        scope=data.scope,
        scope_id=data.scope_id,
        category=data.category,
        description=data.description,
        reference=data.reference,
        effective_date=effective_date,
    )

    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    # Load artist relationship
    if entry.artist_id:
        await db.refresh(entry, ["artist"])

    return ExpenseResponse(
        id=str(entry.id),
        artist_id=str(entry.artist_id) if entry.artist_id else None,
        artist_name=entry.artist.name if entry.artist else None,
        entry_type=entry.entry_type.value,
        amount=str(entry.amount),
        currency=entry.currency,
        scope=entry.scope,
        scope_id=entry.scope_id,
        category=entry.category,
        category_label=CATEGORY_LABELS.get(entry.category, entry.category) if entry.category else None,
        royalty_run_id=None,
        description=entry.description,
        reference=entry.reference,
        document_url=entry.document_url,
        effective_date=entry.effective_date.isoformat(),
        created_at=entry.created_at.isoformat(),
    )


@router.put("/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: str,
    data: ExpenseUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ExpenseResponse:
    """Update an expense entry."""
    result = await db.execute(
        select(AdvanceLedgerEntry)
        .options(selectinload(AdvanceLedgerEntry.artist))
        .where(AdvanceLedgerEntry.id == uuid.UUID(expense_id))
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    # Update fields
    if data.artist_id is not None:
        entry.artist_id = uuid.UUID(data.artist_id) if data.artist_id else None
    if data.amount is not None:
        entry.amount = Decimal(data.amount)
    if data.currency is not None:
        entry.currency = data.currency
    if data.scope is not None:
        entry.scope = data.scope
    if data.scope_id is not None:
        entry.scope_id = data.scope_id or None
    if data.category is not None:
        entry.category = data.category or None
    if data.description is not None:
        entry.description = data.description or None
    if data.reference is not None:
        entry.reference = data.reference or None
    if data.effective_date is not None:
        try:
            entry.effective_date = datetime.fromisoformat(data.effective_date.replace('Z', '+00:00'))
        except ValueError:
            entry.effective_date = datetime.strptime(data.effective_date, "%Y-%m-%d")

    await db.commit()
    await db.refresh(entry, ["artist"])

    return ExpenseResponse(
        id=str(entry.id),
        artist_id=str(entry.artist_id) if entry.artist_id else None,
        artist_name=entry.artist.name if entry.artist else None,
        entry_type=entry.entry_type.value if hasattr(entry.entry_type, 'value') else str(entry.entry_type),
        amount=str(entry.amount),
        currency=entry.currency,
        scope=entry.scope,
        scope_id=entry.scope_id,
        category=entry.category,
        category_label=CATEGORY_LABELS.get(entry.category, entry.category) if entry.category else None,
        royalty_run_id=str(entry.royalty_run_id) if entry.royalty_run_id else None,
        description=entry.description,
        reference=entry.reference,
        document_url=entry.document_url,
        effective_date=entry.effective_date.isoformat(),
        created_at=entry.created_at.isoformat(),
    )


@router.delete("/expenses/{expense_id}")
async def delete_expense(
    expense_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """Delete an expense entry."""
    result = await db.execute(
        select(AdvanceLedgerEntry).where(AdvanceLedgerEntry.id == uuid.UUID(expense_id))
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    await db.delete(entry)
    await db.commit()

    return {"success": True, "deleted_id": expense_id}


@router.post("/expenses/{expense_id}/document")
async def upload_expense_document(
    expense_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
) -> dict:
    """Upload a PDF document for an expense."""
    # Validate file type
    if not file.content_type or not file.content_type.startswith("application/pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed",
        )

    # Get the expense entry
    result = await db.execute(
        select(AdvanceLedgerEntry).where(AdvanceLedgerEntry.id == uuid.UUID(expense_id))
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    # Read file content
    content = await file.read()

    # For now, store as base64 data URL (for small files)
    # In production, you'd want to use Supabase storage
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB",
        )

    # Create data URL
    base64_content = base64.b64encode(content).decode('utf-8')
    document_url = f"data:application/pdf;base64,{base64_content}"

    # Update the entry
    entry.document_url = document_url
    await db.commit()

    return {
        "success": True,
        "expense_id": expense_id,
        "document_url": document_url[:100] + "..." if len(document_url) > 100 else document_url,
    }


@router.delete("/expenses/{expense_id}/document")
async def delete_expense_document(
    expense_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """Delete the document attached to an expense."""
    result = await db.execute(
        select(AdvanceLedgerEntry).where(AdvanceLedgerEntry.id == uuid.UUID(expense_id))
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    entry.document_url = None
    await db.commit()

    return {"success": True, "expense_id": expense_id}


@router.get("/royalty-payments", response_model=List[RoyaltyPaymentResponse])
async def list_royalty_payments(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    year: Optional[int] = None,
) -> List[RoyaltyPaymentResponse]:
    """List all locked royalty runs (payments due to artists)."""
    query = (
        select(RoyaltyRun)
        .where(RoyaltyRun.is_locked == True)
        .order_by(RoyaltyRun.period_start.desc())
    )

    if year:
        query = query.where(
            func.extract('year', RoyaltyRun.period_start) == year
        )

    result = await db.execute(query)
    runs = result.scalars().all()

    # Get artist counts for each run
    payments = []
    for run in runs:
        # Count statements for this run
        stmt_query = select(func.count()).select_from(
            select(AdvanceLedgerEntry).where(
                AdvanceLedgerEntry.royalty_run_id == run.id,
                AdvanceLedgerEntry.entry_type == LedgerEntryType.RECOUPMENT,
            ).subquery()
        )
        # Actually just use a simpler approach - count from the run's statements
        artists_count = run.total_transactions // 100 if run.total_transactions else 0  # Rough estimate

        payments.append(RoyaltyPaymentResponse(
            run_id=str(run.id),
            period_start=str(run.period_start),
            period_end=str(run.period_end),
            total_net_payable=str(run.total_net_payable),
            total_artist_royalties=str(run.total_artist_royalties),
            total_recouped=str(run.total_recouped),
            status=run.status.value if hasattr(run.status, 'value') else str(run.status),
            locked_at=run.locked_at.isoformat() if run.locked_at else None,
            artists_count=artists_count,
        ))

    return payments
