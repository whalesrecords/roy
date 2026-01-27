"""
Promo Schemas

Pydantic models for promo submission API requests and responses.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PromoSubmissionBase(BaseModel):
    """Base schema for promo submissions."""
    artist_id: UUID
    release_upc: Optional[str] = None
    track_isrc: Optional[str] = None
    song_title: str
    source: str
    campaign_id: Optional[UUID] = None
    campaign_url: Optional[str] = None

    # SubmitHub fields
    outlet_name: Optional[str] = None
    outlet_type: Optional[str] = None
    action: Optional[str] = None
    listen_time: Optional[int] = None

    # Groover fields
    influencer_name: Optional[str] = None
    influencer_type: Optional[str] = None
    decision: Optional[str] = None
    sharing_link: Optional[str] = None

    # Common fields
    feedback: Optional[str] = None
    submitted_at: Optional[date] = None
    responded_at: Optional[date] = None


class PromoSubmissionCreate(PromoSubmissionBase):
    """Schema for creating a promo submission."""
    pass


class PromoSubmissionResponse(PromoSubmissionBase):
    """Schema for promo submission response."""
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubmitHubAnalyzeResponse(BaseModel):
    """Response for SubmitHub CSV analysis."""
    total_rows: int
    sample_rows: List[dict]
    columns_detected: List[str]
    warnings: List[str] = Field(default_factory=list)
    artists_found: List[str] = Field(default_factory=list)


class GrooverAnalyzeResponse(BaseModel):
    """Response for Groover CSV analysis."""
    total_rows: int
    sample_rows: List[dict]
    columns_detected: List[str]
    warnings: List[str] = Field(default_factory=list)


class SongMatch(BaseModel):
    """Matched song from catalog."""
    song_title: str
    track_isrc: Optional[str] = None
    release_upc: Optional[str] = None
    match_confidence: str  # exact, fuzzy, none


class ImportSubmitHubResponse(BaseModel):
    """Response for SubmitHub import."""
    created_count: int
    matched_songs: List[SongMatch]
    unmatched_songs: List[str]
    campaign_id: Optional[UUID] = None
    errors: List[str] = Field(default_factory=list)


class ImportGrooverResponse(BaseModel):
    """Response for Groover import."""
    created_count: int
    matched_songs: List[SongMatch]
    unmatched_songs: List[str]
    campaign_id: Optional[UUID] = None
    errors: List[str] = Field(default_factory=list)


class PromoStatsResponse(BaseModel):
    """Stats for promo submissions."""
    total_submissions: int
    by_source: dict
    by_action: dict
    by_decision: dict
    total_listens: int
    total_approvals: int
    total_playlists: int


class PromoCampaignCreate(BaseModel):
    """Schema for creating a promo campaign."""
    artist_id: UUID
    name: str
    source: str
    release_upc: Optional[str] = None
    track_isrc: Optional[str] = None
    budget: Optional[Decimal] = None
    status: str = "active"
    started_at: Optional[date] = None


class PromoCampaignResponse(BaseModel):
    """Schema for campaign response."""
    id: UUID
    artist_id: UUID
    name: str
    source: str
    release_upc: Optional[str]
    track_isrc: Optional[str]
    budget: Optional[Decimal]
    status: str
    started_at: Optional[date]
    ended_at: Optional[date]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PromoSubmissionsListResponse(BaseModel):
    """Response for listing promo submissions."""
    submissions: List[PromoSubmissionResponse]
    total_count: int
    page: int
    page_size: int
