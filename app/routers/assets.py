"""
Fixed Assets Router

API endpoints for capital asset (immobilisations) management.

Supports linear and degressive depreciation per French rules, PCG account
mapping, and CSV import from a Reverb gear collection export.
"""

import csv
import io
import re
from calendar import monthrange
from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import verify_admin_token
from app.core.database import get_db
from app.models.fixed_asset import (
    DEFAULT_LIFE_MONTHS,
    PCG_DEFAULTS,
    AssetCategory,
    AssetStatus,
    DepreciationMethod,
    FixedAsset,
)

router = APIRouter(prefix="/assets", tags=["assets"])


# --- Schemas ---


class AssetCreate(BaseModel):
    name: str = Field(..., max_length=300)
    category: str = Field(default=AssetCategory.OTHER.value)
    pcg_account: Optional[str] = Field(None, max_length=10)
    internal_ref: Optional[str] = Field(None, max_length=50)
    purchase_date: date
    purchase_amount_ht: float = Field(..., ge=0)
    vat_rate: float = Field(default=20.0, ge=0, le=100)
    useful_life_months: Optional[int] = Field(None, ge=1)
    depreciation_method: str = Field(default=DepreciationMethod.LINEAR.value)
    location: Optional[str] = None
    serial_number: Optional[str] = None
    supplier: Optional[str] = None
    invoice_reference: Optional[str] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    pcg_account: Optional[str] = None
    internal_ref: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_amount_ht: Optional[float] = None
    vat_rate: Optional[float] = None
    useful_life_months: Optional[int] = None
    depreciation_method: Optional[str] = None
    location: Optional[str] = None
    serial_number: Optional[str] = None
    supplier: Optional[str] = None
    invoice_reference: Optional[str] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    disposal_date: Optional[date] = None
    disposal_amount: Optional[float] = None


class DepreciationYear(BaseModel):
    year: int
    opening_value: float       # VNC au 1er janvier
    annual_charge: float       # Dotation aux amortissements de l'année
    accumulated: float         # Amortissements cumulés à fin d'année
    closing_value: float       # VNC au 31 décembre


class AssetResponse(BaseModel):
    id: UUID
    name: str
    category: str
    pcg_account: str
    internal_ref: Optional[str]
    purchase_date: date
    purchase_amount_ht: float
    vat_rate: float
    useful_life_months: int
    depreciation_method: str
    location: Optional[str]
    serial_number: Optional[str]
    supplier: Optional[str]
    invoice_reference: Optional[str]
    image_url: Optional[str]
    notes: Optional[str]
    status: str
    disposal_date: Optional[date]
    disposal_amount: Optional[float]
    accumulated_depreciation: float = 0.0
    net_book_value: float = 0.0
    annual_charge_current_year: float = 0.0
    schedule: List[DepreciationYear] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AssetsSummary(BaseModel):
    total_count: int
    total_gross_value: float          # Valeur brute totale
    total_accumulated: float          # Amortissements cumulés à ce jour
    total_net_book_value: float       # VNC totale
    current_year_charge: float        # Dotation de l'année en cours
    by_category: dict                 # { category: { count, gross, nbv } }
    by_pcg_account: dict              # { pcg_account: gross_total }


class ImportResult(BaseModel):
    created: int
    skipped: int
    errors: List[str]


# --- Depreciation engine ---


def _degressive_coefficient(life_months: int) -> float:
    """French degressive coefficient based on useful life in years."""
    years = life_months / 12
    if years < 3:
        return 1.0
    if 3 <= years <= 4:
        return 1.25
    if 5 <= years <= 6:
        return 1.75
    return 2.25


def _months_in_year(start: date, end: date, year: int) -> int:
    """How many full months of `year` are covered by the [start, end] window."""
    y_start = date(year, 1, 1)
    y_end = date(year, 12, 31)
    a = max(start, y_start)
    b = min(end, y_end)
    if b < a:
        return 0
    return (b.year - a.year) * 12 + (b.month - a.month) + 1


def compute_schedule(asset: FixedAsset) -> List[DepreciationYear]:
    """Compute the year-by-year depreciation table for an asset."""
    gross = float(asset.purchase_amount_ht)
    life_m = max(int(asset.useful_life_months), 1)
    start = asset.purchase_date
    method = asset.depreciation_method

    # Last day of the final depreciation month
    final_month_index = start.month + life_m - 1
    end_year = start.year + (final_month_index - 1) // 12
    end_month = ((final_month_index - 1) % 12) + 1
    end = date(end_year, end_month, monthrange(end_year, end_month)[1])

    schedule: List[DepreciationYear] = []
    accumulated = 0.0

    if method == DepreciationMethod.LINEAR.value:
        monthly = gross / life_m
        for year in range(start.year, end.year + 1):
            months = _months_in_year(start, end, year)
            charge = round(monthly * months, 2)
            # Last year: settle any rounding so total == gross
            if year == end.year:
                charge = round(gross - accumulated, 2)
            opening = round(gross - accumulated, 2)
            accumulated = round(accumulated + charge, 2)
            closing = round(gross - accumulated, 2)
            schedule.append(DepreciationYear(
                year=year,
                opening_value=opening,
                annual_charge=charge,
                accumulated=accumulated,
                closing_value=max(closing, 0.0),
            ))
        return schedule

    # Degressive method (French)
    coef = _degressive_coefficient(life_m)
    deg_rate = (1.0 / (life_m / 12)) * coef  # annual rate
    remaining_book = gross
    # First year prorata = number of full months from purchase month
    months_first_year = 12 - start.month + 1
    for year in range(start.year, end.year + 1):
        # Years remaining (incl. current)
        years_remaining = end.year - year + 1
        opening = round(remaining_book, 2)
        # Switch-over: linear on remaining when it beats degressive
        linear_rate_on_remaining = 1.0 / years_remaining if years_remaining > 0 else 1.0
        rate = max(deg_rate, linear_rate_on_remaining)

        if year == start.year:
            charge = remaining_book * deg_rate * (months_first_year / 12)
        else:
            charge = remaining_book * rate

        charge = round(charge, 2)
        if year == end.year:
            charge = round(remaining_book, 2)  # write down to zero
        accumulated = round(accumulated + charge, 2)
        remaining_book = round(remaining_book - charge, 2)
        schedule.append(DepreciationYear(
            year=year,
            opening_value=opening,
            annual_charge=charge,
            accumulated=accumulated,
            closing_value=max(remaining_book, 0.0),
        ))
    return schedule


def _project_asset(asset: FixedAsset, as_of: Optional[date] = None) -> dict:
    """Serialize an asset and attach schedule + current depreciation metrics."""
    as_of = as_of or date.today()
    schedule = compute_schedule(asset)
    accumulated = 0.0
    current_charge = 0.0
    for row in schedule:
        if row.year < as_of.year:
            accumulated += row.annual_charge
        elif row.year == as_of.year:
            current_charge = row.annual_charge
            # Prorate current-year charge by elapsed months
            prorate = max(0, min(12, as_of.month)) / 12.0
            accumulated += row.annual_charge * prorate
    accumulated = round(accumulated, 2)
    nbv = round(float(asset.purchase_amount_ht) - accumulated, 2)

    data = {c.name: getattr(asset, c.name) for c in FixedAsset.__table__.columns}
    data["purchase_amount_ht"] = float(data["purchase_amount_ht"])
    data["vat_rate"] = float(data["vat_rate"])
    if data.get("disposal_amount") is not None:
        data["disposal_amount"] = float(data["disposal_amount"])
    data["accumulated_depreciation"] = accumulated
    data["net_book_value"] = max(nbv, 0.0)
    data["annual_charge_current_year"] = current_charge
    data["schedule"] = schedule
    return data


# --- Endpoints ---


@router.get("", response_model=List[AssetResponse])
async def list_assets(
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
    category: Optional[str] = None,
    pcg_account: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    """List all assets with optional filters."""
    query = select(FixedAsset).order_by(FixedAsset.purchase_date.desc())
    if category:
        query = query.where(FixedAsset.category == category)
    if pcg_account:
        query = query.where(FixedAsset.pcg_account == pcg_account)
    if status:
        query = query.where(FixedAsset.status == status)
    if search:
        query = query.where(FixedAsset.name.ilike(f"%{search}%"))
    result = await db.execute(query)
    assets = result.scalars().all()
    return [_project_asset(a) for a in assets]


@router.get("/summary", response_model=AssetsSummary)
async def assets_summary(
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate stats: gross value, accumulated, NBV, current-year charge."""
    result = await db.execute(select(FixedAsset).where(FixedAsset.status != AssetStatus.DISPOSED.value))
    assets = result.scalars().all()

    total_gross = 0.0
    total_accumulated = 0.0
    total_charge = 0.0
    by_cat: dict = {}
    by_acc: dict = {}
    for a in assets:
        projected = _project_asset(a)
        gross = float(a.purchase_amount_ht)
        total_gross += gross
        total_accumulated += projected["accumulated_depreciation"]
        total_charge += projected["annual_charge_current_year"]
        cat = by_cat.setdefault(a.category, {"count": 0, "gross": 0.0, "nbv": 0.0})
        cat["count"] += 1
        cat["gross"] += gross
        cat["nbv"] += projected["net_book_value"]
        by_acc[a.pcg_account] = by_acc.get(a.pcg_account, 0.0) + gross

    return AssetsSummary(
        total_count=len(assets),
        total_gross_value=round(total_gross, 2),
        total_accumulated=round(total_accumulated, 2),
        total_net_book_value=round(total_gross - total_accumulated, 2),
        current_year_charge=round(total_charge, 2),
        by_category={k: {kk: round(vv, 2) if isinstance(vv, float) else vv for kk, vv in v.items()} for k, v in by_cat.items()},
        by_pcg_account={k: round(v, 2) for k, v in by_acc.items()},
    )


@router.post("", response_model=AssetResponse, status_code=201)
async def create_asset(
    data: AssetCreate,
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Create a new fixed asset. Defaults pcg_account and life from category."""
    payload = data.model_dump()
    cat = AssetCategory(payload["category"])
    if not payload.get("pcg_account"):
        payload["pcg_account"] = PCG_DEFAULTS[cat]
    if not payload.get("useful_life_months"):
        payload["useful_life_months"] = DEFAULT_LIFE_MONTHS[cat]
    asset = FixedAsset(**payload)
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return _project_asset(asset)


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: UUID,
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FixedAsset).where(FixedAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return _project_asset(asset)


@router.put("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: UUID,
    data: AssetUpdate,
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FixedAsset).where(FixedAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    asset.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(asset)
    return _project_asset(asset)


@router.delete("/{asset_id}")
async def delete_asset(
    asset_id: UUID,
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FixedAsset).where(FixedAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.delete(asset)
    await db.commit()
    return {"message": "Asset deleted"}


# --- Reverb gear collection CSV import ---


_REVERB_CATEGORY_MAP = {
    "keyboards-and-synths": AssetCategory.STUDIO_GEAR,
    "pro-audio": AssetCategory.STUDIO_GEAR,
    "effects-and-pedals": AssetCategory.STUDIO_GEAR,
    "amps": AssetCategory.STUDIO_GEAR,
    "electric-guitars": AssetCategory.STUDIO_GEAR,
    "bass-guitars": AssetCategory.STUDIO_GEAR,
    "acoustic-guitars": AssetCategory.STUDIO_GEAR,
    "drums-and-percussion": AssetCategory.STUDIO_GEAR,
    "folk-instruments": AssetCategory.STUDIO_GEAR,
    "home-audio": AssetCategory.STUDIO_GEAR,
    "accessories": AssetCategory.OTHER,
    "parts": AssetCategory.OTHER,
    "unknown": AssetCategory.OTHER,
}


def _parse_reverb_year(year_str: str) -> Optional[date]:
    """Pull a 4-digit year out of strings like '1972', '1968 - 1974', '2018 - Present'."""
    if not year_str:
        return None
    match = re.search(r"\d{4}", year_str)
    if not match:
        return None
    try:
        return date(int(match.group()), 1, 1)
    except ValueError:
        return None


@router.post("/import/reverb", response_model=ImportResult)
async def import_reverb_csv(
    file: UploadFile = File(...),
    default_purchase_date: Optional[str] = Form(None),
    include_zero_cost: bool = Form(True),
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Import a Reverb gear collection CSV (Settings → Gear Collection → Export).

    Purchase date comes from the `year` column when present, else from
    `default_purchase_date` (ISO date). Acquisition amount HT is `owner_cost`
    (or `price` if cost is empty). When include_zero_cost is True (default)
    items without a declared cost are still imported with amount=0 so they
    appear in the inventory — they just have no depreciation.
    Image URL falls back through image_1..image_5.
    """
    raw = await file.read()
    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    fallback = None
    if default_purchase_date:
        try:
            fallback = date.fromisoformat(default_purchase_date)
        except ValueError:
            fallback = None

    existing_q = await db.execute(select(FixedAsset))
    existing = existing_q.scalars().all()
    by_key = {(a.name.lower(), (a.serial_number or "").lower()): a for a in existing}

    created = 0
    skipped = 0
    updated = 0
    errors: List[str] = []

    for row in reader:
        try:
            title = (row.get("title") or "").strip()
            if not title:
                skipped += 1
                continue
            cost_str = (row.get("owner_cost") or "").strip() or "0"
            price_str = (row.get("price") or "").strip() or "0"
            try:
                cost = float(cost_str)
            except ValueError:
                cost = 0.0
            try:
                price = float(price_str)
            except ValueError:
                price = 0.0
            amount = cost if cost > 0 else price
            if amount <= 0 and not include_zero_cost:
                skipped += 1
                continue
            amount = max(amount, 0.0)

            purchase = _parse_reverb_year(row.get("year") or "") or fallback
            if not purchase:
                skipped += 1
                continue

            serial = (row.get("serial_number") or "").strip()
            key = (title.lower(), serial.lower())

            product_type = (row.get("product_type") or "").strip().lower()
            cat = _REVERB_CATEGORY_MAP.get(product_type, AssetCategory.STUDIO_GEAR)
            url = (row.get("url") or "").strip() or None
            image: Optional[str] = None
            for col in ("image_1", "image_2", "image_3", "image_4", "image_5"):
                candidate = (row.get(col) or "").strip()
                if candidate:
                    image = candidate
                    break

            # If the asset already exists, backfill the image when one is now
            # available — useful when re-importing a CSV that has new photos.
            existing_asset = by_key.get(key)
            if existing_asset is not None:
                if image and not existing_asset.image_url:
                    existing_asset.image_url = image
                    existing_asset.updated_at = datetime.utcnow()
                    updated += 1
                else:
                    skipped += 1
                continue

            condition = (row.get("condition") or "").strip()
            make = (row.get("make") or "").strip()
            model = (row.get("model") or "").strip()
            notes_bits = [s for s in [
                make + " " + model if make or model else "",
                f"Condition: {condition}" if condition else "",
                f"Reverb: {url}" if url else "",
            ] if s]

            asset = FixedAsset(
                name=title[:300],
                category=cat.value,
                pcg_account=PCG_DEFAULTS[cat],
                useful_life_months=DEFAULT_LIFE_MONTHS[cat],
                depreciation_method=DepreciationMethod.LINEAR.value,
                purchase_date=purchase,
                purchase_amount_ht=amount,
                vat_rate=20.0,
                serial_number=serial or None,
                supplier="Reverb",
                image_url=image,
                notes=" • ".join(notes_bits) if notes_bits else None,
                status=AssetStatus.ACTIVE.value,
            )
            db.add(asset)
            by_key[key] = asset
            created += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Ligne ignorée: {exc}")

    if created or updated:
        await db.commit()

    if updated:
        # surface the number of photo backfills in the message via errors slot
        errors.insert(0, f"{updated} photo(s) ajoutée(s) sur des immobilisations existantes")
    return ImportResult(created=created, skipped=skipped, errors=errors)
