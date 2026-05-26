"""
Inventory Router

API endpoints for physical product inventory management (vinyl, CD, merch).
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import verify_admin_token
from app.core.database import get_db
from app.models.product import MovementType, Product, ProductFormat, ProductStatus, StockMovement
from app.models.transaction import SaleType, TransactionNormalized

router = APIRouter(prefix="/inventory", tags=["inventory"])


# --- Schemas ---

class ProductCreate(BaseModel):
    title: str = Field(..., max_length=300)
    format: str = Field(default="vinyl")
    variant: Optional[str] = Field(None, max_length=100)
    sku: Optional[str] = Field(None, max_length=50)
    release_upc: Optional[str] = Field(None, max_length=20)
    artist_name: Optional[str] = Field(None, max_length=200)
    price_eur: Optional[float] = None
    cost_eur: Optional[float] = None
    stock_quantity: int = Field(default=0, ge=0)
    low_stock_threshold: int = Field(default=10, ge=0)
    status: str = Field(default="available")
    limited_edition: bool = False
    edition_size: Optional[int] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None


class ProductUpdate(BaseModel):
    title: Optional[str] = None
    format: Optional[str] = None
    variant: Optional[str] = None
    sku: Optional[str] = None
    release_upc: Optional[str] = None
    artist_name: Optional[str] = None
    price_eur: Optional[float] = None
    cost_eur: Optional[float] = None
    low_stock_threshold: Optional[int] = None
    status: Optional[str] = None
    limited_edition: Optional[bool] = None
    edition_size: Optional[int] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None


class StockAdjustment(BaseModel):
    quantity: int = Field(..., description="Positive for in, negative for out")
    movement_type: str = Field(default="adjustment")
    reason: Optional[str] = None
    source: Optional[str] = None


class ProductResponse(BaseModel):
    id: UUID
    title: str
    format: str
    variant: Optional[str]
    sku: Optional[str]
    release_upc: Optional[str]
    artist_name: Optional[str]
    price_eur: Optional[float]
    cost_eur: Optional[float]
    stock_quantity: int
    low_stock_threshold: int
    status: str
    limited_edition: bool
    edition_size: Optional[int]
    image_url: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StockMovementResponse(BaseModel):
    id: UUID
    product_id: UUID
    movement_type: str
    quantity: int
    reason: Optional[str]
    source: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class InventorySummary(BaseModel):
    total_products: int
    total_stock: int
    low_stock_count: int
    total_value: float
    by_format: dict
    by_status: dict


# --- Endpoints ---

@router.get("/products", response_model=List[ProductResponse])
async def list_products(
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
    format: Optional[str] = None,
    status: Optional[str] = None,
    low_stock: bool = False,
    search: Optional[str] = None,
):
    """List all products with optional filters."""
    query = select(Product).order_by(Product.title)

    if format:
        query = query.where(Product.format == format)
    if status:
        query = query.where(Product.status == status)
    if low_stock:
        query = query.where(Product.stock_quantity <= Product.low_stock_threshold)
    if search:
        query = query.where(
            Product.title.ilike(f"%{search}%") |
            Product.artist_name.ilike(f"%{search}%") |
            Product.sku.ilike(f"%{search}%")
        )

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/summary", response_model=InventorySummary)
async def get_inventory_summary(
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Get inventory overview stats."""
    result = await db.execute(select(Product))
    products = result.scalars().all()

    total_value = sum(
        (p.price_eur or 0) * p.stock_quantity
        for p in products
    )

    by_format: dict = {}
    by_status: dict = {}
    low_stock_count = 0

    for p in products:
        by_format[p.format] = by_format.get(p.format, 0) + 1
        by_status[p.status] = by_status.get(p.status, 0) + 1
        if p.stock_quantity <= p.low_stock_threshold:
            low_stock_count += 1

    return InventorySummary(
        total_products=len(products),
        total_stock=sum(p.stock_quantity for p in products),
        low_stock_count=low_stock_count,
        total_value=float(total_value),
        by_format=by_format,
        by_status=by_status,
    )


@router.post("/products", response_model=ProductResponse, status_code=201)
async def create_product(
    data: ProductCreate,
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Create a new product."""
    product = Product(**data.model_dump())
    db.add(product)

    # Create initial stock movement if stock > 0
    if data.stock_quantity > 0:
        movement = StockMovement(
            product_id=product.id,
            movement_type=MovementType.IN,
            quantity=data.stock_quantity,
            reason="Stock initial",
            source="manual",
        )
        db.add(movement)

    await db.commit()
    await db.refresh(product)
    return product


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Get a single product."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    data: ProductUpdate,
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Update a product."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    product.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: UUID,
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Delete a product."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    await db.delete(product)
    await db.commit()
    return {"message": "Product deleted"}


@router.post("/products/{product_id}/stock", response_model=ProductResponse)
async def adjust_stock(
    product_id: UUID,
    data: StockAdjustment,
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Adjust stock for a product (add, remove, correct)."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    new_quantity = product.stock_quantity + data.quantity
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail=f"Stock cannot go below 0 (current: {product.stock_quantity}, adjustment: {data.quantity})")

    product.stock_quantity = new_quantity
    product.updated_at = datetime.utcnow()

    # Auto-update status
    if new_quantity == 0 and product.status == "available":
        product.status = "sold_out"
    elif new_quantity > 0 and product.status == "sold_out":
        product.status = "available"

    movement = StockMovement(
        product_id=product.id,
        movement_type=data.movement_type,
        quantity=data.quantity,
        reason=data.reason,
        source=data.source,
    )
    db.add(movement)

    await db.commit()
    await db.refresh(product)
    return product


@router.get("/products/{product_id}/movements", response_model=List[StockMovementResponse])
async def get_stock_movements(
    product_id: UUID,
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    """Get stock movement history for a product."""
    result = await db.execute(
        select(StockMovement)
        .where(StockMovement.product_id == product_id)
        .order_by(StockMovement.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


def _guess_product_format(text: str) -> str:
    """Guess ProductFormat from a title or package description string."""
    t = (text or '').lower()
    if any(w in t for w in ['vinyl', 'lp', '12"', "12''", '12 inch', '10"', '7"', 'vinyle']):
        return ProductFormat.VINYL
    if any(w in t for w in ['cassette', 'tape', 'k7']):
        return ProductFormat.CASSETTE
    if any(w in t for w in ['bundle', 'pack', 'coffret']):
        return ProductFormat.BUNDLE
    if any(w in t for w in ['shirt', 'tee', 'hoodie', 'tote', 'poster', 'patch', 'pin', 'sticker', 'merch']):
        return ProductFormat.MERCH
    if any(w in t for w in ['cd', 'compact disc', 'digipack', 'digipak', 'digi pack', 'digi-pack']):
        return ProductFormat.CD
    # Color-only variants (Black, White, Natural & Black, etc.) = vinyl color press
    _color_words = {'black', 'white', 'natural', 'red', 'blue', 'green', 'clear', 'transparent',
                    'gold', 'silver', 'orange', 'purple', 'pink', 'yellow', 'splatter', 'marble'}
    words = set(t.replace('&', ' ').replace('-', ' ').split())
    if words and words.issubset(_color_words | {'edition', 'limited', 'and', ''}):
        return ProductFormat.VINYL
    return ProductFormat.CD


@router.post("/auto-discover", response_model=List[ProductResponse])
async def auto_discover_products(
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Auto-discover physical products from Bandcamp/Squarespace/DetailsDetails transactions.
    Creates inventory items for any physical sale items not already tracked.
    """
    # Find distinct physical items from transactions
    # Use COALESCE(release_title, track_title) since item_title column does not exist
    # Include physical_format which holds "Compact Disc (CD)", "Vinyl LP", "Cassette", etc.
    item_title_col = func.coalesce(
        TransactionNormalized.release_title,
        TransactionNormalized.track_title,
    ).label('item_title')

    result = await db.execute(
        select(
            item_title_col,
            TransactionNormalized.artist_name,
            TransactionNormalized.upc,
            TransactionNormalized.store_name,
            TransactionNormalized.physical_format,
            func.sum(TransactionNormalized.quantity).label('total_sold'),
            func.sum(TransactionNormalized.gross_amount).label('total_revenue'),
        )
        .where(TransactionNormalized.sale_type == SaleType.PHYSICAL)
        .group_by(
            TransactionNormalized.release_title,
            TransactionNormalized.track_title,
            TransactionNormalized.artist_name,
            TransactionNormalized.upc,
            TransactionNormalized.store_name,
            TransactionNormalized.physical_format,
        )
        .order_by(func.sum(TransactionNormalized.quantity).desc())
    )
    physical_items = result.all()

    # Get existing products to avoid duplicates
    existing = await db.execute(select(Product))
    existing_products = existing.scalars().all()
    # Dedup key includes physical_format so same album in different formats = separate products
    existing_keys = {(p.title.lower(), (p.artist_name or '').lower(), (p.variant or '').lower()) for p in existing_products}

    created = []
    for item in physical_items:
        title = item.item_title or 'Unknown'
        artist = item.artist_name or ''
        physical_fmt = item.physical_format or ''

        # Use physical_format for accurate format detection, fallback to title keywords
        fmt = _guess_product_format(physical_fmt or title)
        # variant = the raw physical format string (e.g. "CD Digipack", "Vinyl LP")
        variant = physical_fmt or None

        key = (title.lower(), artist.lower(), (variant or '').lower())
        if key in existing_keys:
            continue

        product = Product(
            title=title,
            format=fmt,
            variant=variant,
            artist_name=artist,
            release_upc=item.upc,
            status=ProductStatus.AVAILABLE,
            stock_quantity=0,  # Unknown stock — user will adjust
            notes=f"Auto-découvert depuis {item.store_name}. {item.total_sold or 0} unités vendues.",
        )
        db.add(product)
        created.append(product)
        existing_keys.add(key)

    if created:
        await db.commit()
        for p in created:
            await db.refresh(p)

    return created


class ImportCSVResult(BaseModel):
    created: int
    skipped: int
    errors: List[str]


@router.post("/import-csv", response_model=ImportCSVResult)
async def import_inventory_csv(
    file: UploadFile = File(...),
    source: str = Form(...),
    _token: str = Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Import physical products from a Bandcamp or Squarespace CSV export.
    Only 'package' rows (physical items) are imported.
    """
    if source not in ("bandcamp", "squarespace"):
        raise HTTPException(status_code=400, detail="source must be 'bandcamp' or 'squarespace'")

    content = await file.read()
    # Detect encoding from BOM: Bandcamp exports UTF-16 LE (0xFF 0xFE)
    if content[:2] in (b"\xff\xfe", b"\xfe\xff"):
        text = content.decode("utf-16")
    else:
        try:
            text = content.decode("utf-8-sig")  # UTF-8 with optional BOM
        except UnicodeDecodeError:
            text = content.decode("latin-1")

    # Parse the CSV using the appropriate parser
    errors: list[str] = []
    rows = []
    try:
        if source == "bandcamp":
            from app.services.parsers.bandcamp import BandcampParser
            result_obj = BandcampParser().parse(text)
            rows = result_obj.rows
        else:
            from app.services.parsers.squarespace import SquarespaceParser
            result_obj = SquarespaceParser().parse(text)
            rows = result_obj.rows
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Erreur de lecture du fichier CSV: {e}")

    # Keep only physical/package rows
    package_rows = [r for r in rows if r.item_type == "package"]
    if not package_rows:
        return ImportCSVResult(created=0, skipped=0, errors=["Aucun article physique trouvé dans ce fichier."])

    # Load existing products for dedup
    existing_result = await db.execute(select(Product))
    existing_products = existing_result.scalars().all()
    existing_keys = {(p.title.lower(), (p.artist_name or '').lower()) for p in existing_products}

    created_count = 0
    skipped_count = 0

    for row in package_rows:
        title = (row.item_name or '').strip() or 'Unknown'
        artist = (row.artist or '').strip()

        key = (title.lower(), artist.lower())
        if key in existing_keys:
            skipped_count += 1
            continue

        # Guess format from package description (Bandcamp) or title
        format_hint = getattr(row, 'package', None) or title
        fmt = _guess_product_format(format_hint)

        # Optional fields that differ between parsers
        sku = getattr(row, 'sku', None) or None
        variant = getattr(row, 'variant', None) or None
        upc = getattr(row, 'upc', None) or None

        # Use the actual stock count when the CSV provides it (products format)
        initial_stock = getattr(row, 'stock_quantity', 0) or 0

        product = Product(
            title=title,
            format=fmt,
            artist_name=artist or None,
            sku=sku,
            variant=variant,
            release_upc=upc,
            status=ProductStatus.AVAILABLE,
            stock_quantity=initial_stock,
            notes=f"Importé depuis {source.capitalize()} CSV.",
        )
        db.add(product)
        existing_keys.add(key)
        created_count += 1

    if created_count > 0:
        await db.commit()

    return ImportCSVResult(created=created_count, skipped=skipped_count, errors=errors)
