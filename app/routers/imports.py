"""
Imports Router

Handles CSV file uploads and import processing.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models import Import, ImportSource, ImportStatus
from app.schemas.imports import (
    ImportResponse,
    ImportErrorDetail,
    ImportListItem,
    PreviewResponse,
    MappingRequest,
    MappingResponse,
)
from app.models.transaction import TransactionNormalized
from sqlalchemy import select
from app.services.parsers.tunecore import TuneCoreParser, ParseError
from app.services.parsers.bandcamp import BandcampParser
from app.services.normalize import normalize_tunecore_row, normalize_bandcamp_row


router = APIRouter(prefix="/imports", tags=["imports"])


async def verify_admin_token(x_admin_token: Annotated[str, Header()]) -> str:
    """Verify the admin token from header."""
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )
    return x_admin_token


def extract_period_from_filename(filename: str) -> tuple:
    """
    Extract period from TuneCore filename.
    Patterns:
    - "TuneCore_Sales_2024-01.csv"
    - "2024-01_TuneCore.csv"
    - "january_2024.csv"
    - Contains month/year like "2024-01" or "01-2024"
    """
    import calendar
    import re

    if not filename:
        return None, None

    # Pattern: YYYY-MM or YYYY_MM
    match = re.search(r'(\d{4})[-_](\d{2})', filename)
    if match:
        year, month = int(match.group(1)), int(match.group(2))
        if 1 <= month <= 12:
            start = date(year, month, 1)
            last_day = calendar.monthrange(year, month)[1]
            end = date(year, month, last_day)
            return start, end

    # Pattern: MM-YYYY or MM_YYYY
    match = re.search(r'(\d{2})[-_](\d{4})', filename)
    if match:
        month, year = int(match.group(1)), int(match.group(2))
        if 1 <= month <= 12:
            start = date(year, month, 1)
            last_day = calendar.monthrange(year, month)[1]
            end = date(year, month, last_day)
            return start, end

    # Pattern: month name + year (january_2024, jan2024, etc.)
    months = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }

    filename_lower = filename.lower()
    for month_name, month_num in months.items():
        if month_name in filename_lower:
            year_match = re.search(r'(\d{4})', filename)
            if year_match:
                year = int(year_match.group(1))
                start = date(year, month_num, 1)
                last_day = calendar.monthrange(year, month_num)[1]
                end = date(year, month_num, last_day)
                return start, end

    return None, None


@router.post("/analyze")
async def analyze_import(
    source: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Analyze a CSV file before importing.
    Returns detected period, artists with "&", and duplicate check.
    Fast: extracts period from filename first.
    """
    # Validate source
    try:
        import_source = ImportSource(source.lower())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported source: {source}",
        )

    period_start = None
    period_end = None
    artists_with_ampersand = []
    total_artists = 0

    if import_source == ImportSource.TUNECORE:
        # Fast: extract period from filename
        period_start, period_end = extract_period_from_filename(file.filename or "")

    # Check for duplicates (same source, filename, and period)
    duplicate = None
    if period_start and period_end:
        existing = await db.execute(
            select(Import)
            .where(Import.source == import_source)
            .where(Import.filename == file.filename)
            .where(Import.period_start == period_start)
            .where(Import.period_end == period_end)
        )
        dup_record = existing.scalars().first()
        if dup_record:
            duplicate = {
                "id": str(dup_record.id),
                "created_at": dup_record.created_at.isoformat(),
                "status": dup_record.status.value,
                "rows_inserted": dup_record.rows_inserted,
            }

    return {
        "period_start": period_start.isoformat() if period_start else None,
        "period_end": period_end.isoformat() if period_end else None,
        "artists_with_ampersand": artists_with_ampersand,
        "total_artists": total_artists,
        "duplicate": duplicate,
    }


@router.post("", response_model=ImportResponse)
async def create_import(
    source: Annotated[str, Form()],
    period_start: Annotated[date, Form()],
    period_end: Annotated[date, Form()],
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> ImportResponse:
    """
    Import a CSV file from a distribution source.

    Currently supports:
    - tunecore: TuneCore music sales reports

    Args:
        source: Distribution source (tunecore, believe, cdbaby)
        period_start: Start of the reporting period
        period_end: End of the reporting period
        file: CSV file to import

    Returns:
        Import result with statistics and errors
    """
    # Validate source
    try:
        import_source = ImportSource(source.lower())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported source: {source}. Supported: {[s.value for s in ImportSource]}",
        )

    # Validate period
    if period_end < period_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="period_end must be >= period_start",
        )

    # Create import record
    import_record = Import(
        source=import_source,
        status=ImportStatus.PROCESSING,
        filename=file.filename,
        period_start=period_start,
        period_end=period_end,
    )
    db.add(import_record)
    await db.flush()  # Get the ID

    # Read file content
    content = await file.read()

    # Parse based on source
    errors: list[ImportErrorDetail] = []
    transactions = []
    gross_total = Decimal("0")

    if import_source == ImportSource.TUNECORE:
        parser = TuneCoreParser()
        result = parser.parse(content)

        import_record.rows_total = result.total_rows

        # Collect errors
        for err in result.errors:
            errors.append(ImportErrorDetail(
                row_number=err.row_number,
                error=err.error,
                raw_data=err.raw_data,
            ))

        # Normalize and create transactions
        for row in result.rows:
            try:
                transaction = normalize_tunecore_row(
                    row=row,
                    import_id=import_record.id,
                    fallback_period_start=period_start,
                    fallback_period_end=period_end,
                )
                transactions.append(transaction)
                gross_total += transaction.gross_amount
            except Exception as e:
                errors.append(ImportErrorDetail(
                    row_number=row.row_number,
                    error=f"Normalization error: {str(e)}",
                ))

    elif import_source == ImportSource.BANDCAMP:
        parser = BandcampParser()
        result = parser.parse(content)

        import_record.rows_total = result.total_rows

        # Collect errors
        for err in result.errors:
            errors.append(ImportErrorDetail(
                row_number=err.row_number,
                error=err.error,
                raw_data=err.raw_data,
            ))

        # Normalize and create transactions
        for row in result.rows:
            try:
                transaction = normalize_bandcamp_row(
                    row=row,
                    import_id=import_record.id,
                    fallback_period_start=period_start,
                    fallback_period_end=period_end,
                )
                transactions.append(transaction)
                gross_total += transaction.gross_amount
            except Exception as e:
                errors.append(ImportErrorDetail(
                    row_number=row.row_number,
                    error=f"Normalization error: {str(e)}",
                ))

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parser for {source} not yet implemented",
        )

    # Batch insert transactions
    if transactions:
        db.add_all(transactions)

    # Update import record
    import_record.rows_parsed = len(result.rows)
    import_record.rows_inserted = len(transactions)
    import_record.errors_count = len(errors)
    import_record.gross_total = gross_total
    import_record.completed_at = datetime.utcnow()

    # Set final status
    if import_record.errors_count == 0:
        import_record.status = ImportStatus.COMPLETED
    elif import_record.rows_inserted > 0:
        import_record.status = ImportStatus.PARTIAL
    else:
        import_record.status = ImportStatus.FAILED

    await db.commit()

    return ImportResponse(
        import_id=import_record.id,
        status=import_record.status.value,
        rows_parsed=import_record.rows_parsed,
        rows_inserted=import_record.rows_inserted,
        gross_total=import_record.gross_total,
        errors_count=import_record.errors_count,
        sample_errors=errors[:10],  # Limit to first 10 errors
    )


@router.get("", response_model=list[ImportListItem])
async def list_imports(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> list[ImportListItem]:
    """
    List all imports, ordered by creation date descending.
    """
    result = await db.execute(
        select(Import).order_by(Import.created_at.desc())
    )
    imports = result.scalars().all()

    return [
        ImportListItem(
            id=imp.id,
            source=imp.source.value if hasattr(imp.source, 'value') else imp.source,
            status=imp.status.value if hasattr(imp.status, 'value') else imp.status,
            period_start=imp.period_start,
            period_end=imp.period_end,
            filename=imp.filename,
            total_rows=imp.rows_total,
            success_rows=imp.rows_inserted,
            error_rows=imp.errors_count,
            errors=[],  # Errors not stored in detail for list view
            created_at=imp.created_at.isoformat(),
        )
        for imp in imports
    ]


@router.get("/{import_id}/preview", response_model=PreviewResponse)
async def get_import_preview(
    import_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> PreviewResponse:
    """
    Get a preview of the first 20 rows from an import.
    Returns raw column names and values for mapping UI.
    """
    from uuid import UUID

    try:
        uuid_id = UUID(import_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid import ID format",
        )

    # Get import record
    result = await db.execute(select(Import).where(Import.id == uuid_id))
    import_record = result.scalar_one_or_none()

    if not import_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import not found",
        )

    # Get first 20 transactions
    result = await db.execute(
        select(TransactionNormalized)
        .where(TransactionNormalized.import_id == uuid_id)
        .limit(20)
    )
    transactions = result.scalars().all()

    if not transactions:
        # Return empty preview if no transactions
        return PreviewResponse(
            columns=[],
            rows=[],
            total_rows=0,
        )

    # Build preview from normalized data
    columns = [
        "artist_name", "track_title", "release_title", "isrc", "upc",
        "territory", "store", "sale_type", "quantity", "gross_amount",
        "currency", "period_start", "period_end"
    ]

    rows = []
    for tx in transactions:
        rows.append({
            "artist_name": tx.artist_name,
            "track_title": tx.track_title,
            "release_title": tx.release_title or "",
            "isrc": tx.isrc or "",
            "upc": tx.upc or "",
            "territory": tx.territory or "",
            "store": tx.store or "",
            "sale_type": tx.sale_type.value if hasattr(tx.sale_type, 'value') else str(tx.sale_type),
            "quantity": str(tx.quantity),
            "gross_amount": str(tx.gross_amount),
            "currency": tx.currency,
            "period_start": tx.period_start.isoformat() if tx.period_start else "",
            "period_end": tx.period_end.isoformat() if tx.period_end else "",
        })

    return PreviewResponse(
        columns=columns,
        rows=rows,
        total_rows=import_record.rows_inserted,
    )


# In-memory mapping storage (stub - replace with DB storage)
_mapping_store: dict[str, list[dict]] = {}


@router.post("/{import_id}/mapping", response_model=MappingResponse)
async def save_mapping(
    import_id: str,
    request: MappingRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> MappingResponse:
    """
    Save column mapping configuration for an import.
    Currently stores in memory (stub implementation).
    """
    from uuid import UUID

    try:
        uuid_id = UUID(import_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid import ID format",
        )

    # Verify import exists
    result = await db.execute(select(Import).where(Import.id == uuid_id))
    import_record = result.scalar_one_or_none()

    if not import_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import not found",
        )

    # Store mapping (stub - in memory)
    _mapping_store[import_id] = [
        {"source_column": m.source_column, "target_field": m.target_field}
        for m in request.mappings
    ]

    return MappingResponse(success=True)


@router.get("/{import_id}/mapping")
async def get_mapping(
    import_id: str,
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Get saved column mapping for an import.
    """
    mappings = _mapping_store.get(import_id)
    if not mappings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mapping not found",
        )
    return {"mappings": mappings}


@router.delete("/{import_id}")
async def delete_import(
    import_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Delete an import and all its associated transactions.
    """
    from uuid import UUID

    try:
        uuid_id = UUID(import_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid import ID format",
        )

    # Get import record
    result = await db.execute(select(Import).where(Import.id == uuid_id))
    import_record = result.scalar_one_or_none()

    if not import_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import not found",
        )

    # Delete associated transactions first
    await db.execute(
        TransactionNormalized.__table__.delete().where(
            TransactionNormalized.import_id == uuid_id
        )
    )

    # Delete the import
    await db.delete(import_record)
    await db.commit()

    return {"success": True, "deleted_id": import_id}


# Simple in-memory cache for catalog data
_catalog_cache: dict = {}
_cache_timestamp: float = 0
CACHE_TTL_SECONDS = 300  # 5 minutes


@router.get("/catalog/artists")
async def get_catalog_artists(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> list[dict]:
    """
    Get unique artists from imported transactions with their catalog stats.
    Cached for 5 minutes to improve performance.
    """
    import time
    from sqlalchemy import func, distinct

    global _catalog_cache, _cache_timestamp

    # Check cache
    cache_key = "catalog_artists"
    now = time.time()
    if cache_key in _catalog_cache and (now - _cache_timestamp) < CACHE_TTL_SECONDS:
        return _catalog_cache[cache_key]

    # Simplified query without mode() - just use 'EUR' as default
    result = await db.execute(
        select(
            TransactionNormalized.artist_name,
            func.count(distinct(TransactionNormalized.isrc)).label('track_count'),
            func.count(distinct(TransactionNormalized.upc)).label('release_count'),
            func.sum(TransactionNormalized.gross_amount).label('total_gross'),
            func.sum(TransactionNormalized.quantity).label('total_streams'),
        )
        .group_by(TransactionNormalized.artist_name)
        .order_by(func.sum(TransactionNormalized.gross_amount).desc())
    )
    rows = result.all()

    data = [
        {
            "artist_name": row.artist_name,
            "track_count": row.track_count or 0,
            "release_count": row.release_count or 0,
            "total_gross": str(row.total_gross or 0),
            "total_streams": row.total_streams or 0,
            "currency": "EUR",  # Simplified - TuneCore is always EUR
        }
        for row in rows
    ]

    # Update cache
    _catalog_cache[cache_key] = data
    _cache_timestamp = now

    return data


@router.get("/catalog/artists/{artist_name}/releases")
async def get_artist_releases(
    artist_name: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> list[dict]:
    """
    Get releases (albums) for an artist from imported transactions.
    """
    from sqlalchemy import func, distinct
    from urllib.parse import unquote

    decoded_name = unquote(artist_name)

    result = await db.execute(
        select(
            TransactionNormalized.release_title,
            TransactionNormalized.upc,
            func.count(distinct(TransactionNormalized.isrc)).label('track_count'),
            func.sum(TransactionNormalized.gross_amount).label('total_gross'),
            func.sum(TransactionNormalized.quantity).label('total_streams'),
        )
        .where(TransactionNormalized.artist_name == decoded_name)
        .group_by(TransactionNormalized.release_title, TransactionNormalized.upc)
        .order_by(func.sum(TransactionNormalized.gross_amount).desc())
    )
    rows = result.all()

    return [
        {
            "release_title": row.release_title or "Single",
            "upc": row.upc,
            "track_count": row.track_count or 0,
            "total_gross": str(row.total_gross or 0),
            "total_streams": row.total_streams or 0,
            "currency": "EUR",
        }
        for row in rows
    ]


@router.get("/catalog/artists/{artist_name}/tracks")
async def get_artist_tracks(
    artist_name: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> list[dict]:
    """
    Get tracks for an artist from imported transactions.
    """
    from sqlalchemy import func
    from urllib.parse import unquote

    decoded_name = unquote(artist_name)

    result = await db.execute(
        select(
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
            TransactionNormalized.isrc,
            func.sum(TransactionNormalized.gross_amount).label('total_gross'),
            func.sum(TransactionNormalized.quantity).label('total_streams'),
        )
        .where(TransactionNormalized.artist_name == decoded_name)
        .group_by(
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
            TransactionNormalized.isrc,
        )
        .order_by(func.sum(TransactionNormalized.gross_amount).desc())
    )
    rows = result.all()

    return [
        {
            "track_title": row.track_title,
            "release_title": row.release_title,
            "isrc": row.isrc,
            "total_gross": str(row.total_gross or 0),
            "total_streams": row.total_streams or 0,
            "currency": "EUR",
        }
        for row in rows
    ]
