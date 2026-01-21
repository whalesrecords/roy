"""Artwork models for storing Spotify images and catalog metadata."""
import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import String, DateTime, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class ReleaseArtwork(Base):
    """Store artwork and metadata for releases (albums/EPs/singles) by UPC."""

    __tablename__ = "release_artwork"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    upc: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)

    # Spotify data
    spotify_id: Mapped[str] = mapped_column(String(100), nullable=True)
    name: Mapped[str] = mapped_column(String(500), nullable=True)
    image_url: Mapped[str] = mapped_column(String(500), nullable=True)
    image_url_small: Mapped[str] = mapped_column(String(500), nullable=True)

    # Catalog metadata (from Spotify)
    release_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    genres: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    label: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    total_tracks: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    album_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # album, single, compilation

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

    def __repr__(self) -> str:
        return f"<ReleaseArtwork upc={self.upc}>"


class TrackArtwork(Base):
    """Store artwork and metadata for tracks by ISRC."""

    __tablename__ = "track_artwork"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    isrc: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)

    # Spotify data
    spotify_id: Mapped[str] = mapped_column(String(100), nullable=True)
    name: Mapped[str] = mapped_column(String(500), nullable=True)
    album_name: Mapped[str] = mapped_column(String(500), nullable=True)
    image_url: Mapped[str] = mapped_column(String(500), nullable=True)
    image_url_small: Mapped[str] = mapped_column(String(500), nullable=True)

    # Catalog metadata (from Spotify)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    track_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    disc_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    artists: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    release_upc: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)  # Link to release

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

    def __repr__(self) -> str:
        return f"<TrackArtwork isrc={self.isrc}>"
