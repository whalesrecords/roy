"""
Settings Router

API endpoints for label settings management.
"""

import base64
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import LabelSettings

router = APIRouter(prefix="/settings", tags=["settings"])


# Pydantic schemas
class LabelSettingsResponse(BaseModel):
    id: UUID
    label_name: str
    logo_url: Optional[str] = None
    logo_base64: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    siret: Optional[str] = None
    vat_number: Optional[str] = None

    class Config:
        from_attributes = True


class LabelSettingsUpdate(BaseModel):
    label_name: Optional[str] = None
    logo_url: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    siret: Optional[str] = None
    vat_number: Optional[str] = None


@router.get("/label", response_model=Optional[LabelSettingsResponse])
async def get_label_settings(db: AsyncSession = Depends(get_db)):
    """Get label settings. Returns null if not configured."""
    result = await db.execute(select(LabelSettings).limit(1))
    settings = result.scalar_one_or_none()
    return settings


@router.put("/label", response_model=LabelSettingsResponse)
async def update_label_settings(
    data: LabelSettingsUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update label settings. Creates if not exists."""
    result = await db.execute(select(LabelSettings).limit(1))
    settings = result.scalar_one_or_none()

    if not settings:
        # Create new settings
        settings = LabelSettings(
            label_name=data.label_name or "Mon Label",
        )
        db.add(settings)

    # Update fields
    if data.label_name is not None:
        settings.label_name = data.label_name
    if data.logo_url is not None:
        settings.logo_url = data.logo_url
    if data.address_line1 is not None:
        settings.address_line1 = data.address_line1
    if data.address_line2 is not None:
        settings.address_line2 = data.address_line2
    if data.city is not None:
        settings.city = data.city
    if data.postal_code is not None:
        settings.postal_code = data.postal_code
    if data.country is not None:
        settings.country = data.country
    if data.email is not None:
        settings.email = data.email
    if data.phone is not None:
        settings.phone = data.phone
    if data.website is not None:
        settings.website = data.website
    if data.siret is not None:
        settings.siret = data.siret
    if data.vat_number is not None:
        settings.vat_number = data.vat_number

    await db.commit()
    await db.refresh(settings)
    return settings


@router.post("/label/logo", response_model=LabelSettingsResponse)
async def upload_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload logo as base64. Accepts PNG, JPG, WEBP."""
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}",
        )

    # Read and encode file
    content = await file.read()

    # Limit file size (2MB)
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 2MB.")

    # Encode to base64 with data URI
    b64 = base64.b64encode(content).decode("utf-8")
    data_uri = f"data:{file.content_type};base64,{b64}"

    # Get or create settings
    result = await db.execute(select(LabelSettings).limit(1))
    settings = result.scalar_one_or_none()

    if not settings:
        settings = LabelSettings(label_name="Mon Label", logo_base64=data_uri)
        db.add(settings)
    else:
        settings.logo_base64 = data_uri

    await db.commit()
    await db.refresh(settings)
    return settings


@router.delete("/label/logo", response_model=LabelSettingsResponse)
async def delete_logo(db: AsyncSession = Depends(get_db)):
    """Remove the logo."""
    result = await db.execute(select(LabelSettings).limit(1))
    settings = result.scalar_one_or_none()

    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    settings.logo_base64 = None
    settings.logo_url = None
    await db.commit()
    await db.refresh(settings)
    return settings
