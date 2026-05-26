"""Manual catalog release model.

Allows admin to register albums/EPs/singles before sales data is imported,
so they can be referenced in expense scopes, contracts, etc.
"""
import uuid
from datetime import datetime, date
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.artist import Artist
    from app.models.manual_track import ManualTrack


class ManualRelease(Base):
    """Manually-registered release (album / EP / single)."""

    __tablename__ = "manual_releases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    # Commercial identifier — optional until the release is distributed
    upc: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    # Primary artist — nullable so we can store compilations
    artist_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Denormalised name — used when artist_id is null
    artist_name_override: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    release_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    format: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True
    )  # "album" | "ep" | "single" | "compilation"
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Cover art — base64 or URL
    cover_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    artist: Mapped[Optional["Artist"]] = relationship("Artist", lazy="selectin")
    tracks: Mapped[List["ManualTrack"]] = relationship(
        "ManualTrack",
        back_populates="release",
        cascade="all, delete-orphan",
        order_by="ManualTrack.position",
    )
