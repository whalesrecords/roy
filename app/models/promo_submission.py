"""
Promo Submission model for tracking SubmitHub and Groover campaigns.

Stores individual submissions to outlets/influencers from promo campaigns.
Links to catalog via UPC/ISRC when available, or stores song_title as fallback.
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, DateTime, Integer, Text, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.artist import Artist
    from app.models.artwork import ReleaseArtwork, TrackArtwork
    from app.models.promo_campaign import PromoCampaign
    from app.models.advance_ledger import AdvanceLedgerEntry


class PromoSource(str, Enum):
    """Source of promo submission."""
    SUBMITHUB = "submithub"
    GROOVER = "groover"
    MANUAL = "manual"


class SubmitHubAction(str, Enum):
    """SubmitHub curator actions."""
    LISTEN = "listen"
    DECLINED = "declined"
    APPROVED = "approved"
    SHARED = "shared"


class PromoSubmission(Base):
    """
    Individual submission to an outlet/influencer from a promo campaign.

    Tracks results from SubmitHub and Groover campaigns, including
    feedback, actions, and placements.
    """

    __tablename__ = "promo_submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Artist relationship
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Catalog links (optional - may not match existing releases/tracks)
    release_upc: Mapped[Optional[str]] = mapped_column(
        String(50),
        ForeignKey("release_artwork.upc", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    track_isrc: Mapped[Optional[str]] = mapped_column(
        String(20),
        ForeignKey("track_artwork.isrc", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Song info (always stored as fallback)
    song_title: Mapped[str] = mapped_column(String(255), nullable=False)

    # Source and campaign info
    source: Mapped[str] = mapped_column(
        SAEnum(PromoSource),
        nullable=False,
        index=True,
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("promo_campaigns.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    campaign_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # SubmitHub specific fields
    outlet_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    outlet_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # blog, playlist, radio, etc.
    action: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )  # listen, declined, approved, shared
    listen_time: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # seconds

    # Groover specific fields
    influencer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    influencer_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # playlist, feedback-only, social-media-sharing
    decision: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    sharing_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Common fields
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
        index=True,
    )
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    artist: Mapped["Artist"] = relationship(
        "Artist",
        back_populates="promo_submissions",
    )
    campaign: Mapped[Optional["PromoCampaign"]] = relationship(
        "PromoCampaign",
        back_populates="submissions",
    )
    release_artwork: Mapped[Optional["ReleaseArtwork"]] = relationship(
        "ReleaseArtwork",
    )
    track_artwork: Mapped[Optional["TrackArtwork"]] = relationship(
        "TrackArtwork",
    )
    advance_ledger_entry: Mapped[Optional["AdvanceLedgerEntry"]] = relationship(
        "AdvanceLedgerEntry",
        back_populates="promo_submission",
    )

    def __repr__(self) -> str:
        return f"<PromoSubmission {self.id} source={self.source} song={self.song_title}>"
