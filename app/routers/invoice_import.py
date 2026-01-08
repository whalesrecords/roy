"""
Invoice Import Router.

Handles PDF/image invoice uploads with data extraction.
"""

import base64
from datetime import datetime
from decimal import Decimal
from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.advance_ledger import AdvanceLedgerEntry, LedgerEntryType
from app.models.artist import Artist
from app.services.invoice_extractor import extract_invoice_data


router = APIRouter(prefix="/invoice-import", tags=["invoice-import"])


async def verify_admin_token(x_admin_token: Annotated[str, Header()]) -> str:
    """Verify admin token from request header."""
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token"
        )
    return x_admin_token


# Response schemas

class ExtractedInvoiceResponse(BaseModel):
    """Response from invoice extraction."""
    success: bool
    filename: str
    # From filename
    date_from_filename: Optional[str] = None
    category_from_filename: Optional[str] = None
    artist_from_filename: Optional[str] = None
    # From PDF content
    invoice_number: Optional[str] = None
    vendor_name: Optional[str] = None
    total_amount: Optional[str] = None
    currency: str = "EUR"
    album_or_track: Optional[str] = None
    description: Optional[str] = None
    # Metadata
    confidence_score: float = 0.0
    raw_text: str = ""
    warnings: List[str] = []
    error: Optional[str] = None
    # Document for storage
    document_base64: Optional[str] = None


class CreateAdvanceFromInvoice(BaseModel):
    """Request to create advance from invoice data."""
    artist_id: Optional[str] = None
    amount: str
    currency: str = "EUR"
    scope: str = "catalog"
    scope_id: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    reference: Optional[str] = None
    effective_date: str
    document_base64: Optional[str] = None


class AdvanceCreatedResponse(BaseModel):
    """Response after creating advance."""
    id: str
    artist_id: Optional[str] = None
    amount: str
    currency: str
    category: Optional[str] = None
    reference: Optional[str] = None
    effective_date: str


@router.post("/extract", response_model=ExtractedInvoiceResponse)
async def extract_invoice(
    file: UploadFile = File(...),
    _token: str = Depends(verify_admin_token),
) -> ExtractedInvoiceResponse:
    """
    Upload PDF or image invoice and extract data.

    Supports: PDF, PNG, JPG, JPEG
    Returns extracted fields for user validation.
    """
    # Validate file type
    allowed_types = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
    ]

    content_type = file.content_type or ""
    if content_type not in allowed_types:
        # Also check by extension
        filename = file.filename or ""
        ext = filename.lower().split(".")[-1] if "." in filename else ""
        if ext not in ["pdf", "png", "jpg", "jpeg"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Type de fichier non supporté: {content_type}. Acceptés: PDF, PNG, JPG"
            )

    # Read content
    content = await file.read()

    # Size limit (10MB)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fichier trop volumineux. Maximum: 10MB"
        )

    filename = file.filename or "invoice.pdf"

    try:
        # Extract data
        extracted = await extract_invoice_data(content, filename)

        # Prepare document for storage (base64)
        mime_type = content_type or "application/pdf"
        document_base64 = f"data:{mime_type};base64,{base64.b64encode(content).decode('utf-8')}"

        return ExtractedInvoiceResponse(
            success=True,
            filename=filename,
            date_from_filename=extracted.date_from_filename,
            category_from_filename=extracted.category_from_filename,
            artist_from_filename=extracted.artist_from_filename,
            invoice_number=extracted.invoice_number,
            vendor_name=extracted.vendor_name,
            total_amount=extracted.total_amount,
            currency=extracted.currency,
            album_or_track=extracted.album_or_track,
            description=extracted.description,
            confidence_score=extracted.confidence_score,
            raw_text=extracted.raw_text[:2000],  # Limit for response
            warnings=extracted.warnings,
            document_base64=document_base64,
        )

    except Exception as e:
        return ExtractedInvoiceResponse(
            success=False,
            filename=filename,
            error=str(e),
        )


@router.post("/create-advance", response_model=AdvanceCreatedResponse)
async def create_advance_from_invoice(
    data: CreateAdvanceFromInvoice,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: str = Depends(verify_admin_token),
) -> AdvanceCreatedResponse:
    """
    Create an advance entry from validated invoice data.
    """
    # Parse effective date
    try:
        if "T" in data.effective_date:
            effective_date = datetime.fromisoformat(data.effective_date.replace("Z", "+00:00"))
        else:
            effective_date = datetime.strptime(data.effective_date, "%Y-%m-%d")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Format de date invalide: {e}"
        )

    # Validate artist if provided
    artist_uuid = None
    if data.artist_id:
        try:
            artist_uuid = UUID(data.artist_id)
            result = await db.execute(
                select(Artist).where(Artist.id == artist_uuid)
            )
            artist = result.scalar_one_or_none()
            if not artist:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Artiste non trouvé: {data.artist_id}"
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"ID artiste invalide: {data.artist_id}"
            )

    # Parse amount
    try:
        amount = Decimal(data.amount.replace(",", "."))
        if amount <= 0:
            raise ValueError("Amount must be positive")
    except (ValueError, decimal.InvalidOperation) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Montant invalide: {data.amount}"
        )

    # Create advance entry
    entry = AdvanceLedgerEntry(
        artist_id=artist_uuid,
        entry_type=LedgerEntryType.ADVANCE,
        amount=amount,
        currency=data.currency,
        scope=data.scope,
        scope_id=data.scope_id if data.scope != "catalog" else None,
        category=data.category,
        description=data.description,
        reference=data.reference,
        document_url=data.document_base64,
        effective_date=effective_date,
    )

    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    return AdvanceCreatedResponse(
        id=str(entry.id),
        artist_id=str(entry.artist_id) if entry.artist_id else None,
        amount=str(entry.amount),
        currency=entry.currency,
        category=entry.category,
        reference=entry.reference,
        effective_date=entry.effective_date.isoformat(),
    )


@router.post("/batch-extract", response_model=List[ExtractedInvoiceResponse])
async def batch_extract_invoices(
    files: List[UploadFile] = File(...),
    _token: str = Depends(verify_admin_token),
) -> List[ExtractedInvoiceResponse]:
    """
    Upload multiple invoice files and extract data from all.
    """
    results = []

    for file in files:
        try:
            content = await file.read()
            filename = file.filename or "invoice.pdf"

            # Skip oversized files
            if len(content) > 10 * 1024 * 1024:
                results.append(ExtractedInvoiceResponse(
                    success=False,
                    filename=filename,
                    error="Fichier trop volumineux (max 10MB)"
                ))
                continue

            extracted = await extract_invoice_data(content, filename)

            mime_type = file.content_type or "application/pdf"
            document_base64 = f"data:{mime_type};base64,{base64.b64encode(content).decode('utf-8')}"

            results.append(ExtractedInvoiceResponse(
                success=True,
                filename=filename,
                date_from_filename=extracted.date_from_filename,
                category_from_filename=extracted.category_from_filename,
                artist_from_filename=extracted.artist_from_filename,
                invoice_number=extracted.invoice_number,
                vendor_name=extracted.vendor_name,
                total_amount=extracted.total_amount,
                currency=extracted.currency,
                album_or_track=extracted.album_or_track,
                description=extracted.description,
                confidence_score=extracted.confidence_score,
                raw_text=extracted.raw_text[:1000],
                warnings=extracted.warnings,
                document_base64=document_base64,
            ))

        except Exception as e:
            results.append(ExtractedInvoiceResponse(
                success=False,
                filename=file.filename or "unknown",
                error=str(e),
            ))

    return results


@router.post("/batch-create", response_model=List[AdvanceCreatedResponse])
async def batch_create_advances(
    advances: List[CreateAdvanceFromInvoice],
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: str = Depends(verify_admin_token),
) -> List[AdvanceCreatedResponse]:
    """
    Create multiple advance entries from validated invoice data.
    """
    results = []

    for data in advances:
        try:
            # Parse date
            if "T" in data.effective_date:
                effective_date = datetime.fromisoformat(data.effective_date.replace("Z", "+00:00"))
            else:
                effective_date = datetime.strptime(data.effective_date, "%Y-%m-%d")

            # Parse artist ID
            artist_uuid = UUID(data.artist_id) if data.artist_id else None

            # Parse amount
            amount = Decimal(data.amount.replace(",", "."))

            entry = AdvanceLedgerEntry(
                artist_id=artist_uuid,
                entry_type=LedgerEntryType.ADVANCE,
                amount=amount,
                currency=data.currency,
                scope=data.scope,
                scope_id=data.scope_id if data.scope != "catalog" else None,
                category=data.category,
                description=data.description,
                reference=data.reference,
                document_url=data.document_base64,
                effective_date=effective_date,
            )

            db.add(entry)
            await db.flush()
            await db.refresh(entry)

            results.append(AdvanceCreatedResponse(
                id=str(entry.id),
                artist_id=str(entry.artist_id) if entry.artist_id else None,
                amount=str(entry.amount),
                currency=entry.currency,
                category=entry.category,
                reference=entry.reference,
                effective_date=entry.effective_date.isoformat(),
            ))

        except Exception as e:
            # Skip failed entries but continue with others
            continue

    await db.commit()

    return results
