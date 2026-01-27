"""
Promo Campaign model for grouping related promo submissions.

Tracks campaigns run on SubmitHub/Groover with budgets and metrics.
"""
import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, DateTime, Numeric, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.artist import Artist
    from app.models.promo_submission import PromoSubmission


class CampaignStatus(str, Enum):
    """Status of promo campaign."""
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PromoCampaign(Base):
    """
    Promo campaign grouping related submissions.

    Tracks budget, dates, and overall metrics for a promotional campaign.
    """

    __tablename__ = "promo_campaigns"

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

    # Campaign info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )  # submithub, groover, manual

    # Optional catalog scope
    release_upc: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    track_isrc: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Budget tracking
    budget: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=15, scale=2),
        nullable=True,
    )

    # Campaign status
    status: Mapped[str] = mapped_column(
        SAEnum(CampaignStatus),
        default=CampaignStatus.DRAFT,
        nullable=False,
        index=True,
    )

    # Dates
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

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
        back_populates="promo_campaigns",
    )
    submissions: Mapped[List["PromoSubmission"]] = relationship(
        "PromoSubmission",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<PromoCampaign {self.id} name={self.name} status={self.status}>"
