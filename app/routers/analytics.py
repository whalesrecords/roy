"""
Analytics Router

Provides analytics data for revenue and expenses.
"""

from datetime import date
from decimal import Decimal
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models import Import, ImportSource
from app.models.transaction import TransactionNormalized
from app.models.advance_ledger import AdvanceLedgerEntry, LedgerEntryType
from app.models.royalty_run import RoyaltyRun, RoyaltyRunStatus


router = APIRouter(prefix="/analytics", tags=["analytics"])


async def verify_admin_token(x_admin_token: Annotated[str, Header()]) -> str:
    """Verify the admin token from header."""
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )
    return x_admin_token


# Response schemas

class MonthlyRevenue(BaseModel):
    """Revenue for a specific month."""
    month: int
    year: int
    month_label: str
    gross: str
    source_breakdown: dict[str, str]


class SourceRevenue(BaseModel):
    """Revenue from a specific source."""
    source: str
    source_label: str
    gross: str
    transaction_count: int


class MonthlyExpense(BaseModel):
    """Expenses for a specific month."""
    month: int
    year: int
    month_label: str
    amount: str
    category_breakdown: dict[str, str]


class CategoryExpense(BaseModel):
    """Expenses for a specific category."""
    category: str
    category_label: str
    amount: str
    count: int


class RoyaltiesPayable(BaseModel):
    """Royalties payable to artists."""
    period_start: str
    period_end: str
    net_payable: str
    status: str


class AnalyticsSummary(BaseModel):
    """Overall analytics summary."""
    total_revenue: str
    total_expenses: str  # Avances + frais
    total_royalties_payable: str  # Royalties à verser aux artistes
    total_outflow: str  # Expenses + Royalties
    net: str  # Revenue - total_outflow
    currency: str
    monthly_revenue: List[MonthlyRevenue]
    monthly_expenses: List[MonthlyExpense]
    revenue_by_source: List[SourceRevenue]
    expenses_by_category: List[CategoryExpense]
    royalties_payable: List[RoyaltiesPayable]


# Source labels
SOURCE_LABELS = {
    "tunecore": "TuneCore",
    "believe": "Believe",
    "believe_uk": "Believe UK",
    "believe_fr": "Believe FR",
    "cdbaby": "CD Baby",
    "bandcamp": "Bandcamp",
    "other": "Autre",
}

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
    "royalties": "Royalties artistes",
    "other": "Autre",
    None: "Non categorise",
}

MONTH_LABELS = {
    1: "Jan", 2: "Fev", 3: "Mar", 4: "Avr",
    5: "Mai", 6: "Jun", 7: "Jul", 8: "Aou",
    9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
}


@router.get("/summary", response_model=AnalyticsSummary)
async def get_analytics_summary(
    year: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> AnalyticsSummary:
    """
    Get analytics summary for a specific year.

    Returns:
    - Total revenue and expenses
    - Monthly breakdown of revenue and expenses
    - Revenue by source
    - Expenses by category
    """
    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)

    # Get all transactions for the year with their import source
    tx_query = (
        select(
            TransactionNormalized.gross_amount,
            TransactionNormalized.period_start,
            Import.source,
        )
        .join(Import, TransactionNormalized.import_id == Import.id)
        .where(
            TransactionNormalized.period_start >= start_date,
            TransactionNormalized.period_end <= end_date,
        )
    )
    tx_result = await db.execute(tx_query)
    transactions = tx_result.all()

    # Aggregate revenue by month and source
    monthly_revenue_data: dict[tuple[int, int], dict] = {}
    source_revenue_data: dict[str, dict] = {}
    total_revenue = Decimal("0")

    for tx in transactions:
        amount = tx.gross_amount or Decimal("0")
        total_revenue += amount

        month = tx.period_start.month
        year_val = tx.period_start.year
        source = tx.source.value if tx.source else "other"

        # Monthly aggregation
        key = (year_val, month)
        if key not in monthly_revenue_data:
            monthly_revenue_data[key] = {
                "gross": Decimal("0"),
                "sources": {},
            }
        monthly_revenue_data[key]["gross"] += amount
        if source not in monthly_revenue_data[key]["sources"]:
            monthly_revenue_data[key]["sources"][source] = Decimal("0")
        monthly_revenue_data[key]["sources"][source] += amount

        # Source aggregation
        if source not in source_revenue_data:
            source_revenue_data[source] = {
                "gross": Decimal("0"),
                "count": 0,
            }
        source_revenue_data[source]["gross"] += amount
        source_revenue_data[source]["count"] += 1

    # Get expenses for the year (advances with entry_type = ADVANCE)
    expense_query = (
        select(AdvanceLedgerEntry)
        .where(
            AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE,
            func.extract('year', AdvanceLedgerEntry.effective_date) == year,
        )
    )
    expense_result = await db.execute(expense_query)
    expenses = expense_result.scalars().all()

    # Aggregate expenses by month and category
    monthly_expense_data: dict[tuple[int, int], dict] = {}
    category_expense_data: dict[str, dict] = {}
    total_expenses = Decimal("0")

    for exp in expenses:
        amount = exp.amount or Decimal("0")
        total_expenses += amount

        month = exp.effective_date.month
        year_val = exp.effective_date.year
        category = exp.category or "other"

        # Monthly aggregation
        key = (year_val, month)
        if key not in monthly_expense_data:
            monthly_expense_data[key] = {
                "amount": Decimal("0"),
                "categories": {},
            }
        monthly_expense_data[key]["amount"] += amount
        if category not in monthly_expense_data[key]["categories"]:
            monthly_expense_data[key]["categories"][category] = Decimal("0")
        monthly_expense_data[key]["categories"][category] += amount

        # Category aggregation
        if category not in category_expense_data:
            category_expense_data[category] = {
                "amount": Decimal("0"),
                "count": 0,
            }
        category_expense_data[category]["amount"] += amount
        category_expense_data[category]["count"] += 1

    # Get royalties payable from locked royalty runs for the year
    royalty_runs_query = (
        select(RoyaltyRun)
        .where(
            RoyaltyRun.is_locked == True,
            func.extract('year', RoyaltyRun.period_start) == year,
        )
        .order_by(RoyaltyRun.period_start)
    )
    royalty_runs_result = await db.execute(royalty_runs_query)
    royalty_runs = royalty_runs_result.scalars().all()

    total_royalties_payable = Decimal("0")
    royalties_payable_list: List[RoyaltiesPayable] = []

    for run in royalty_runs:
        net_payable = run.total_net_payable or Decimal("0")
        total_royalties_payable += net_payable
        royalties_payable_list.append(RoyaltiesPayable(
            period_start=str(run.period_start),
            period_end=str(run.period_end),
            net_payable=str(net_payable),
            status=run.status.value if hasattr(run.status, 'value') else str(run.status),
        ))

        # Add royalties to monthly expense data (as a special category)
        month = run.period_end.month
        year_val = run.period_end.year
        key = (year_val, month)
        if key not in monthly_expense_data:
            monthly_expense_data[key] = {
                "amount": Decimal("0"),
                "categories": {},
            }
        monthly_expense_data[key]["amount"] += net_payable
        if "royalties" not in monthly_expense_data[key]["categories"]:
            monthly_expense_data[key]["categories"]["royalties"] = Decimal("0")
        monthly_expense_data[key]["categories"]["royalties"] += net_payable

    # Add royalties to category data
    if total_royalties_payable > 0:
        category_expense_data["royalties"] = {
            "amount": total_royalties_payable,
            "count": len(royalty_runs),
        }

    # Build response
    monthly_revenue = []
    for (y, m), data in sorted(monthly_revenue_data.items()):
        monthly_revenue.append(MonthlyRevenue(
            month=m,
            year=y,
            month_label=MONTH_LABELS.get(m, str(m)),
            gross=str(data["gross"]),
            source_breakdown={k: str(v) for k, v in data["sources"].items()},
        ))

    monthly_expenses = []
    for (y, m), data in sorted(monthly_expense_data.items()):
        monthly_expenses.append(MonthlyExpense(
            month=m,
            year=y,
            month_label=MONTH_LABELS.get(m, str(m)),
            amount=str(data["amount"]),
            category_breakdown={k: str(v) for k, v in data["categories"].items()},
        ))

    revenue_by_source = [
        SourceRevenue(
            source=source,
            source_label=SOURCE_LABELS.get(source, source.capitalize()),
            gross=str(data["gross"]),
            transaction_count=data["count"],
        )
        for source, data in sorted(source_revenue_data.items(), key=lambda x: x[1]["gross"], reverse=True)
    ]

    expenses_by_category = [
        CategoryExpense(
            category=cat or "uncategorized",
            category_label=CATEGORY_LABELS.get(cat, cat.capitalize() if cat else "Non categorise"),
            amount=str(data["amount"]),
            count=data["count"],
        )
        for cat, data in sorted(category_expense_data.items(), key=lambda x: x[1]["amount"], reverse=True)
    ]

    total_outflow = total_expenses + total_royalties_payable

    return AnalyticsSummary(
        total_revenue=str(total_revenue),
        total_expenses=str(total_expenses),
        total_royalties_payable=str(total_royalties_payable),
        total_outflow=str(total_outflow),
        net=str(total_revenue - total_outflow),
        currency="EUR",
        monthly_revenue=monthly_revenue,
        monthly_expenses=monthly_expenses,
        revenue_by_source=revenue_by_source,
        expenses_by_category=expenses_by_category,
        royalties_payable=royalties_payable_list,
    )
