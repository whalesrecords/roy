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


class CreateManualPromoSubmission(BaseModel):
    """Schema for manually creating a promo submission via the admin UI."""
    artist_id: UUID
    song_title: str
    outlet_name: str
    link: Optional[str] = None
    notes: Optional[str] = None


class PromoSubmissionResponse(PromoSubmissionBase):
    """Schema for promo submission response."""
    id: UUID
    created_at: datetime
    updated_at: datetime
    artist_name: Optional[str] = None
    release_title: Optional[str] = None

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
    unmatched_artists: List[str] = Field(default_factory=list)
    detected_band_names: List[str] = Field(default_factory=list)


class SongMatch(BaseModel):
    """Matched song from catalog."""
    song_title: str
    track_isrc: Optional[str] = None
    release_upc: Optional[str] = None
    match_confidence: str  # exact, fuzzy, none


class ImportSubmitHubResponse(BaseModel):
    """Response for SubmitHub import."""
    created_count: int
    skipped_duplicates: int = 0
    matched_songs: List[SongMatch]
    unmatched_songs: List[str]
    campaign_id: Optional[UUID] = None
    errors: List[str] = Field(default_factory=list)


class ImportGrooverResponse(BaseModel):
    """Response for Groover import."""
    created_count: int
    skipped_duplicates: int = 0
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


class ArtistPromoStats(BaseModel):
    """Promo stats for a single artist."""
    artist_id: UUID
    artist_name: str
    total_submissions: int
    total_listened: int
    total_approved: int
    total_declined: int
    total_shared: int
    total_playlists: int
    approval_rate: float  # percentage


class AlbumPromoStats(BaseModel):
    """Promo stats for a single album."""
    release_upc: Optional[str]
    release_title: str
    artist_id: UUID
    artist_name: str
    total_submissions: int
    total_listened: int
    total_approved: int
    total_declined: int
    total_shared: int
    total_playlists: int
    approval_rate: float  # percentage


class DetailedPromoStatsResponse(BaseModel):
    """Detailed stats with breakdowns by artist and album."""
    # Global stats
    total_submissions: int
    by_source: dict
    by_action: dict
    by_decision: dict
    total_listens: int
    total_approvals: int
    total_playlists: int

    # Breakdowns
    by_artist: List["ArtistPromoStats"]
    by_album: List["AlbumPromoStats"]


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


class TrackSummary(BaseModel):
    """Summary of promo submissions for a single track."""
    song_title: str
    artist_id: UUID
    artist_name: str
    release_title: Optional[str] = None
    release_upc: Optional[str] = None
    track_isrc: Optional[str] = None
    total_submissions: int
    total_listened: int
    total_approved: int
    total_declined: int
    total_shared: int
    total_playlists: int
    sources: List[str]
    latest_submitted_at: Optional[datetime] = None


class TracksSummaryResponse(BaseModel):
    """Response for tracks summary."""
    tracks: List[TrackSummary]
    total_tracks: int


# ============ Spotify Ad Campaigns ============

class SpotifyAdCampaignResponse(BaseModel):
    """A single Spotify ad campaign (campaign-level metrics)."""
    id: UUID
    artist_id: UUID
    artist_name: Optional[str] = None
    campaign_name: str
    release_name: Optional[str] = None
    release_upc: Optional[str] = None
    track_isrc: Optional[str] = None
    ad_format: Optional[str] = None
    release_type: Optional[str] = None
    country: Optional[str] = None
    currency: str = "EUR"
    budget: Optional[str] = None
    spend: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reach: Optional[int] = None
    clicks: Optional[int] = None
    amplified_listeners: Optional[int] = None
    reactivated_listeners: Optional[int] = None
    new_active_listeners: Optional[int] = None
    converted_listeners: Optional[int] = None
    conversion_rate: Optional[str] = None
    active_streams_per_listener: Optional[str] = None
    intent_rate: Optional[str] = None
    playlist_adds: Optional[int] = None
    playlist_add_rate: Optional[str] = None
    saves: Optional[int] = None
    save_rate: Optional[str] = None
    listeners_other_releases: Optional[int] = None
    streams_per_listener_other_releases: Optional[str] = None
    saves_other_releases: Optional[int] = None
    playlist_adds_other_releases: Optional[int] = None


class SpotifyAdCampaignsListResponse(BaseModel):
    """List of Spotify ad campaigns with aggregate spend."""
    campaigns: List[SpotifyAdCampaignResponse]
    count: int
    total_spend: str
    currency: str = "EUR"


class ImportSpotifyAdsResponse(BaseModel):
    """Result of importing a Spotify Ad Studio CSV."""
    created_count: int
    skipped_duplicates: int
    updated_count: int = 0
    total_spend: str
    matched_campaigns: int
    artists_not_found: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)


class MetaAdCampaignResponse(BaseModel):
    """A single Meta (Facebook/Instagram) ad (ad-level metrics)."""
    id: UUID
    artist_id: UUID
    artist_name: Optional[str] = None
    ad_name: str
    title: Optional[str] = None
    platform: Optional[str] = None
    result_type: Optional[str] = None
    release_upc: Optional[str] = None
    track_isrc: Optional[str] = None
    currency: str = "EUR"
    spend: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reach: Optional[int] = None
    impressions: Optional[int] = None
    link_clicks: Optional[int] = None
    clicks_all: Optional[int] = None
    results: Optional[int] = None
    cpc: Optional[str] = None
    cpm: Optional[str] = None
    ctr: Optional[str] = None


class MetaAdCampaignsListResponse(BaseModel):
    """List of Meta ad campaigns with aggregate spend."""
    campaigns: List[MetaAdCampaignResponse]
    count: int
    total_spend: str
    currency: str = "EUR"


class ImportMetaAdsResponse(BaseModel):
    """Result of importing a Meta Ads Manager CSV."""
    created_count: int
    skipped_duplicates: int
    updated_count: int = 0
    total_spend: str
    matched_campaigns: int
    artists_not_found: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
