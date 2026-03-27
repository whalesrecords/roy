"""
Analytics Router

Provides analytics data for revenue and expenses.
"""

from datetime import date
from decimal import Decimal
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import verify_admin_token
from app.core.database import get_db
from app.models import Import, ImportSource
from app.models.transaction import TransactionNormalized
from app.models.advance_ledger import AdvanceLedgerEntry, LedgerEntryType
from app.models.royalty_run import RoyaltyRun, RoyaltyRunStatus


router = APIRouter(prefix="/analytics", tags=["analytics"])


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

    # --- Revenue: aggregate by (month, year, source) in SQL ---
    tx_by_month_source = await db.execute(
        select(
            extract("month", TransactionNormalized.period_start).label("month"),
            extract("year", TransactionNormalized.period_start).label("year_val"),
            Import.source,
            func.sum(TransactionNormalized.gross_amount).label("gross"),
            func.count(TransactionNormalized.id).label("cnt"),
        )
        .join(Import, TransactionNormalized.import_id == Import.id)
        .where(
            TransactionNormalized.period_start >= start_date,
            TransactionNormalized.period_end <= end_date,
        )
        .group_by("month", "year_val", Import.source)
    )
    tx_rows = tx_by_month_source.all()

    monthly_revenue_data: dict[tuple[int, int], dict] = {}
    source_revenue_data: dict[str, dict] = {}
    total_revenue = Decimal("0")

    for row in tx_rows:
        amount = Decimal(str(row.gross or 0))
        total_revenue += amount
        month = int(row.month)
        year_val = int(row.year_val)
        source = row.source.value if row.source else "other"

        key = (year_val, month)
        if key not in monthly_revenue_data:
            monthly_revenue_data[key] = {"gross": Decimal("0"), "sources": {}}
        monthly_revenue_data[key]["gross"] += amount
        monthly_revenue_data[key]["sources"][source] = (
            monthly_revenue_data[key]["sources"].get(source, Decimal("0")) + amount
        )

        if source not in source_revenue_data:
            source_revenue_data[source] = {"gross": Decimal("0"), "count": 0}
        source_revenue_data[source]["gross"] += amount
        source_revenue_data[source]["count"] += int(row.cnt)

    # --- Expenses: aggregate by (month, year, category) in SQL ---
    exp_by_month_cat = await db.execute(
        select(
            extract("month", AdvanceLedgerEntry.effective_date).label("month"),
            extract("year", AdvanceLedgerEntry.effective_date).label("year_val"),
            AdvanceLedgerEntry.category,
            func.sum(AdvanceLedgerEntry.amount).label("amount"),
            func.count(AdvanceLedgerEntry.id).label("cnt"),
        )
        .where(
            AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE,
            extract("year", AdvanceLedgerEntry.effective_date) == year,
        )
        .group_by("month", "year_val", AdvanceLedgerEntry.category)
    )
    exp_rows = exp_by_month_cat.all()

    monthly_expense_data: dict[tuple[int, int], dict] = {}
    category_expense_data: dict[str, dict] = {}
    total_expenses = Decimal("0")

    for row in exp_rows:
        amount = Decimal(str(row.amount or 0))
        total_expenses += amount
        month = int(row.month)
        year_val = int(row.year_val)
        category = row.category or "other"

        key = (year_val, month)
        if key not in monthly_expense_data:
            monthly_expense_data[key] = {"amount": Decimal("0"), "categories": {}}
        monthly_expense_data[key]["amount"] += amount
        monthly_expense_data[key]["categories"][category] = (
            monthly_expense_data[key]["categories"].get(category, Decimal("0")) + amount
        )

        if category not in category_expense_data:
            category_expense_data[category] = {"amount": Decimal("0"), "count": 0}
        category_expense_data[category]["amount"] += amount
        category_expense_data[category]["count"] += int(row.cnt)

    # --- Royalty runs (already few rows, no change needed) ---
    royalty_runs_result = await db.execute(
        select(RoyaltyRun)
        .where(
            RoyaltyRun.is_locked == True,
            func.extract("year", RoyaltyRun.period_start) == year,
        )
        .order_by(RoyaltyRun.period_start)
    )
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
            status=run.status.value if hasattr(run.status, "value") else str(run.status),
        ))

        month = run.period_end.month
        year_val = run.period_end.year
        key = (year_val, month)
        if key not in monthly_expense_data:
            monthly_expense_data[key] = {"amount": Decimal("0"), "categories": {}}
        monthly_expense_data[key]["amount"] += net_payable
        monthly_expense_data[key]["categories"]["royalties"] = (
            monthly_expense_data[key]["categories"].get("royalties", Decimal("0")) + net_payable
        )

    if total_royalties_payable > 0:
        category_expense_data["royalties"] = {
            "amount": total_royalties_payable,
            "count": len(royalty_runs),
        }

    # Build response
    monthly_revenue = [
        MonthlyRevenue(
            month=m,
            year=y,
            month_label=MONTH_LABELS.get(m, str(m)),
            gross=str(data["gross"]),
            source_breakdown={k: str(v) for k, v in data["sources"].items()},
        )
        for (y, m), data in sorted(monthly_revenue_data.items())
    ]

    monthly_expenses = [
        MonthlyExpense(
            month=m,
            year=y,
            month_label=MONTH_LABELS.get(m, str(m)),
            amount=str(data["amount"]),
            category_breakdown={k: str(v) for k, v in data["categories"].items()},
        )
        for (y, m), data in sorted(monthly_expense_data.items())
    ]

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
