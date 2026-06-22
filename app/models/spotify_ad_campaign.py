"""
Spotify Ad Campaign model.

Stores the results of a Spotify Ad Studio (Campaigns) CSV export — one row per
campaign run: budget, spend and the key performance metrics. The spend is also
booked as a recoupable advance (see AdvanceLedgerEntry) so it is deducted from
the artist's royalties, while the metrics give the artist full transparency on
what was spent and the results obtained.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SpotifyAdCampaign(Base):
    """A single Spotify Ad Studio campaign run (campaign-level metrics)."""

    __tablename__ = "spotify_ad_campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Optional catalog scope (matched from the release/track name)
    release_upc: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    track_isrc: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Campaign identity
    campaign_name: Mapped[str] = mapped_column(String(255), nullable=False)
    release_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ad_format: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)   # e.g. "Showcase"
    release_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # SINGLE / ALBUM
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Money
    currency: Mapped[str] = mapped_column(String(3), default="EUR", nullable=False)
    budget: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=15, scale=2), nullable=True)
    spend: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=15, scale=2), nullable=True)

    # Dates
    release_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Performance metrics
    reach: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    clicks: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    amplified_listeners: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reactivated_listeners: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    new_active_listeners: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    converted_listeners: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    conversion_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=7, scale=4), nullable=True)
    active_streams_per_listener: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=2), nullable=True)
    intent_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=7, scale=4), nullable=True)
    playlist_add_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=7, scale=4), nullable=True)
    playlist_adds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    save_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=7, scale=4), nullable=True)
    saves: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Link to the recoupable advance booked for this spend
    advance_ledger_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("advance_ledger.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SpotifyAdCampaign {self.id} {self.campaign_name} spend={self.spend}>"
