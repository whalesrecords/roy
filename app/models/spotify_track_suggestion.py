"""
Spotify Track Suggestion Model

Stores tracks detected by the weekly Spotify scanner that match the label
name and are pending admin review (approve = add to catalog, reject = ignore).
"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class SuggestionStatus(str):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class SpotifyTrackSuggestion(Base):
    """A track detected on Spotify that may belong to the label's catalog."""

    __tablename__ = "spotify_track_suggestions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Artist this track is linked to
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Track / album data from Spotify
    spotify_track_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    spotify_album_id: Mapped[str] = mapped_column(String(100), nullable=False)
    track_name: Mapped[str] = mapped_column(String(500), nullable=False)
    album_name: Mapped[str] = mapped_column(String(500), nullable=False)
    album_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # album / single / compilation
    label_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # as returned by Spotify
    release_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    isrc: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    upc: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    spotify_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    track_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Review state
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=SuggestionStatus.PENDING,
        index=True,
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
