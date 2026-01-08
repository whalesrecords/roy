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
from app.services.parsers.squarespace import SquarespaceParser
from app.services.parsers.believe_uk import BelieveUKParser
from app.services.parsers.believe_fr import BelieveFRParser
from app.services.normalize import (
    normalize_tunecore_row,
    normalize_bandcamp_row,
    normalize_squarespace_row,
    normalize_believe_uk_row,
    normalize_believe_fr_row,
    parse_squarespace_date,
)


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
    Extract period from filename.
    Patterns:
    - "TuneCore_Sales_2024-01.csv"
    - "2024-01_TuneCore.csv"
    - "january_2024.csv"
    - "1623552_626771_2025-04-01_2025-06-01.csv" (Believe UK date range)
    - "20170101-20251230_bandcamp_raw_data_xxx.csv" (Bandcamp raw data)
    - Contains month/year like "2024-01" or "01-2024"
    """
    import calendar
    import re

    if not filename:
        return None, None

    # Pattern: Date range YYYYMMDD-YYYYMMDD (Bandcamp raw data format)
    match = re.search(r'(\d{8})-(\d{8})', filename)
    if match:
        try:
            start_str = match.group(1)
            end_str = match.group(2)
            start = date(int(start_str[:4]), int(start_str[4:6]), int(start_str[6:8]))
            end = date(int(end_str[:4]), int(end_str[4:6]), int(end_str[6:8]))
            return start, end
        except ValueError:
            pass

    # Pattern: Date range YYYY-MM-DD_YYYY-MM-DD (Believe UK format)
    match = re.search(r'(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})', filename)
    if match:
        try:
            start = date.fromisoformat(match.group(1))
            end = date.fromisoformat(match.group(2))
            return start, end
        except ValueError:
            pass

    # Pattern: YYYY-Q# (Quarter format, e.g., 2025-Q3)
    match = re.search(r'(\d{4})-Q([1-4])', filename, re.IGNORECASE)
    if match:
        year = int(match.group(1))
        quarter = int(match.group(2))
        # Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
        start_month = (quarter - 1) * 3 + 1
        end_month = quarter * 3
        start = date(year, start_month, 1)
        last_day = calendar.monthrange(year, end_month)[1]
        end = date(year, end_month, last_day)
        return start, end

    # Pattern: YYYY-MM or YYYY_MM
    match = re.search(r'(\d{4})[-_](\d{2})(?!\d)', filename)
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

    if import_source in (ImportSource.TUNECORE, ImportSource.BELIEVE_UK, ImportSource.BELIEVE_FR, ImportSource.BANDCAMP, ImportSource.SQUARESPACE):
        # Fast: extract period from filename
        period_start, period_end = extract_period_from_filename(file.filename or "")

        # For Squarespace, if period not in filename, extract from CSV content
        if import_source == ImportSource.SQUARESPACE and (not period_start or not period_end):
            content = await file.read()
            parser = SquarespaceParser()
            result = parser.parse(content)

            # Extract date range from parsed orders
            dates = []
            for row in result.rows:
                if row.date_from:
                    parsed_date = parse_squarespace_date(row.date_from)
                    if parsed_date:
                        dates.append(parsed_date)

            if dates:
                dates.sort()
                period_start = dates[0]
                period_end = dates[-1]

            # Reset file position for potential re-use
            await file.seek(0)

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

    elif import_source == ImportSource.SQUARESPACE:
        parser = SquarespaceParser()
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
                transaction = normalize_squarespace_row(
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

    elif import_source == ImportSource.BELIEVE_UK:
        parser = BelieveUKParser()
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
                transaction = normalize_believe_uk_row(
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

    elif import_source == ImportSource.BELIEVE_FR:
        parser = BelieveFRParser()
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
                transaction = normalize_believe_fr_row(
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


@router.get("/{import_id}/sale-types")
async def get_import_sale_types(
    import_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Get breakdown of sale types for an import.
    Useful for Bandcamp to see CD vs Vinyl vs Digital.
    """
    from uuid import UUID
    from sqlalchemy import func

    try:
        uuid_id = UUID(import_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid import ID format",
        )

    # Get import to check source
    result = await db.execute(select(Import).where(Import.id == uuid_id))
    import_record = result.scalar_one_or_none()

    if not import_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import not found",
        )

    # Get sale type breakdown
    sale_types_result = await db.execute(
        select(
            TransactionNormalized.sale_type,
            func.count(TransactionNormalized.id).label('count'),
            func.sum(TransactionNormalized.gross_amount).label('total'),
        )
        .where(TransactionNormalized.import_id == uuid_id)
        .group_by(TransactionNormalized.sale_type)
    )
    sale_types = sale_types_result.all()

    # For physical sales (Bandcamp), get format breakdown
    physical_formats_result = await db.execute(
        select(
            TransactionNormalized.physical_format,
            func.count(TransactionNormalized.id).label('count'),
            func.sum(TransactionNormalized.gross_amount).label('total'),
        )
        .where(TransactionNormalized.import_id == uuid_id)
        .where(TransactionNormalized.physical_format.isnot(None))
        .group_by(TransactionNormalized.physical_format)
    )
    physical_formats = physical_formats_result.all()

    return {
        "import_id": import_id,
        "source": import_record.source.value if hasattr(import_record.source, 'value') else import_record.source,
        "sale_types": [
            {
                "type": st.sale_type.value if hasattr(st.sale_type, 'value') else str(st.sale_type),
                "count": st.count,
                "total": str(st.total or 0),
            }
            for st in sale_types
        ],
        "physical_formats": [
            {
                "format": pf.physical_format,
                "count": pf.count,
                "total": str(pf.total or 0),
            }
            for pf in physical_formats
        ],
    }


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
    Includes collaboration releases via track-artist links.
    """
    from sqlalchemy import func, distinct, or_
    from urllib.parse import unquote
    from app.models.artist import Artist
    from app.models.track_artist_link import TrackArtistLink

    decoded_name = unquote(artist_name)

    # Find the artist in the database to get track-artist links
    artist_result = await db.execute(
        select(Artist).where(Artist.name == decoded_name)
    )
    artist = artist_result.scalar_one_or_none()

    # Get ISRCs linked to this artist (collaborations)
    linked_isrcs = set()
    if artist:
        links_result = await db.execute(
            select(TrackArtistLink).where(TrackArtistLink.artist_id == artist.id)
        )
        artist_links = links_result.scalars().all()
        linked_isrcs = {link.isrc for link in artist_links}

    # Query transactions where artist_name matches OR ISRC is in linked_isrcs
    where_clause = TransactionNormalized.artist_name == decoded_name
    if linked_isrcs:
        where_clause = or_(
            TransactionNormalized.artist_name == decoded_name,
            TransactionNormalized.isrc.in_(linked_isrcs),
        )

    result = await db.execute(
        select(
            TransactionNormalized.release_title,
            TransactionNormalized.upc,
            TransactionNormalized.physical_format,
            TransactionNormalized.store_name,
            func.count(distinct(TransactionNormalized.isrc)).label('track_count'),
            func.sum(TransactionNormalized.gross_amount).label('total_gross'),
            func.sum(TransactionNormalized.quantity).label('total_streams'),
        )
        .where(where_clause)
        .group_by(
            TransactionNormalized.release_title,
            TransactionNormalized.upc,
            TransactionNormalized.physical_format,
            TransactionNormalized.store_name,
        )
        .order_by(func.sum(TransactionNormalized.gross_amount).desc())
    )
    rows = result.all()

    # Build UPC mapping: for each release_title, find the first non-UNKNOWN UPC
    upc_mapping = {}
    for row in rows:
        if row.release_title and row.upc and row.upc != "UNKNOWN":
            if row.release_title not in upc_mapping:
                upc_mapping[row.release_title] = row.upc

    return [
        {
            "release_title": row.release_title or "(Sans album)",
            "upc": upc_mapping.get(row.release_title, row.upc) if row.upc == "UNKNOWN" else row.upc,
            "physical_format": row.physical_format,
            "store_name": row.store_name,
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
    Includes collaboration tracks via track-artist links.
    """
    from sqlalchemy import func, or_
    from urllib.parse import unquote
    from app.models.artist import Artist
    from app.models.track_artist_link import TrackArtistLink

    decoded_name = unquote(artist_name)

    # Find the artist in the database to get track-artist links
    artist_result = await db.execute(
        select(Artist).where(Artist.name == decoded_name)
    )
    artist = artist_result.scalar_one_or_none()

    # Get ISRCs linked to this artist (collaborations)
    linked_isrcs = set()
    link_shares = {}
    if artist:
        links_result = await db.execute(
            select(TrackArtistLink).where(TrackArtistLink.artist_id == artist.id)
        )
        artist_links = links_result.scalars().all()
        linked_isrcs = {link.isrc for link in artist_links}
        link_shares = {link.isrc: link.share_percent for link in artist_links}

    # Query transactions where artist_name matches OR ISRC is in linked_isrcs
    where_clause = TransactionNormalized.artist_name == decoded_name
    if linked_isrcs:
        where_clause = or_(
            TransactionNormalized.artist_name == decoded_name,
            TransactionNormalized.isrc.in_(linked_isrcs),
        )

    # Filter out malformed data (headers imported as data)
    from sqlalchemy import and_
    bad_titles = ['isrc', 'track', 'title', 'song', 'name', 'upc', 'artist']

    result = await db.execute(
        select(
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
            TransactionNormalized.isrc,
            TransactionNormalized.artist_name,
            func.sum(TransactionNormalized.gross_amount).label('total_gross'),
            func.sum(TransactionNormalized.quantity).label('total_streams'),
        )
        .where(and_(
            where_clause,
            # Filter out rows where track_title looks like a column header
            TransactionNormalized.track_title.isnot(None),
            func.lower(TransactionNormalized.track_title).notin_(bad_titles),
        ))
        .group_by(
            TransactionNormalized.track_title,
            TransactionNormalized.release_title,
            TransactionNormalized.isrc,
            TransactionNormalized.artist_name,
        )
        .order_by(func.sum(TransactionNormalized.gross_amount).desc())
    )
    rows = result.all()

    # Build response with collaboration share info
    tracks = []
    for row in rows:
        gross = row.total_gross or Decimal("0")
        is_collab = row.artist_name != decoded_name
        share = link_shares.get(row.isrc, Decimal("1")) if is_collab else Decimal("1")
        artist_gross = gross * share

        tracks.append({
            "track_title": row.track_title or "(Sans titre)",
            "release_title": row.release_title,
            "isrc": row.isrc,
            "total_gross": str(artist_gross),
            "total_streams": row.total_streams or 0,
            "currency": "EUR",
            "is_collaboration": is_collab,
            "original_artist": row.artist_name if is_collab else None,
            "share_percent": str(share) if is_collab else None,
        })

    return tracks
