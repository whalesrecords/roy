"""
Meta (Facebook / Instagram) Ad Campaign model.

Stores the results of a Meta Ads Manager CSV export — one row per ad: spend and
the key performance metrics (reach, impressions, clicks, results). The spend is
also booked as a recoupable advance (see AdvanceLedgerEntry, category meta_ads)
so it is deducted from the artist's royalties, while the metrics give the artist
full transparency on what was spent and the results obtained.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MetaAdCampaign(Base):
    """A single Meta (Facebook/Instagram) ad run (ad-level metrics)."""

    __tablename__ = "meta_ad_campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Optional catalog scope (matched from the title in the ad name)
    release_upc: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    track_isrc: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Ad identity
    ad_name: Mapped[str] = mapped_column(String(500), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)       # parsed release/track title
    platform: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)     # Instagram / Facebook
    result_type: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    # Money
    currency: Mapped[str] = mapped_column(String(3), default="EUR", nullable=False)
    spend: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=15, scale=2), nullable=True)

    # Dates (reporting period)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Performance metrics
    reach: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    impressions: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    link_clicks: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    clicks_all: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    results: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cpc: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=12, scale=4), nullable=True)
    cpm: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=12, scale=4), nullable=True)
    ctr: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=10, scale=4), nullable=True)

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
        return f"<MetaAdCampaign {self.id} {self.ad_name} spend={self.spend}>"
