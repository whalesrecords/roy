"""Pydantic schemas for labels (multi-tenant)."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class LabelOut(BaseModel):
    """A label as returned by the API (selector / detail)."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    logo_url: Optional[str] = None
    accent_color: Optional[str] = None
    status: str
    plan: str
    country: Optional[str] = None
    created_at: datetime


class LabelDistributorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: str
    name: str
    account_ref: Optional[str] = None
    notes: Optional[str] = None


class LabelDistributorInput(BaseModel):
    kind: str  # digital | physical | online_sales | tool
    name: str
    account_ref: Optional[str] = None
    notes: Optional[str] = None


class LabelArtistInput(BaseModel):
    """An artist selected during signup (from Spotify search or free text)."""
    name: str
    spotify_id: Optional[str] = None
    image_url: Optional[str] = None


class LabelSignupRequest(BaseModel):
    """Self-service label registration payload."""
    # Account (an admin must already be authenticated via Supabase JWT)
    label_name: str
    country: Optional[str] = None
    accent_color: Optional[str] = None
    logo_base64: Optional[str] = None
    artists: list[LabelArtistInput] = []
    distributors: list[LabelDistributorInput] = []


class LabelSignupResponse(BaseModel):
    label_id: UUID
    slug: str
    status: str
