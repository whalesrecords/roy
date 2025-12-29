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
from app.services.normalize import normalize_tunecore_row


router = APIRouter(prefix="/imports", tags=["imports"])


async def verify_admin_token(x_admin_token: Annotated[str, Header()]) -> str:
    """Verify the admin token from header."""
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )
    return x_admin_token


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
