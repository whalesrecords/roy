"""Artist model for royalty tracking."""
import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class ArtistCategory(str, Enum):
    """Category of artist."""
    SIGNED = "signed"  # Artiste signé chez Whales Records
    COLLABORATOR = "collaborator"  # Collaborateur / Remixeur

if TYPE_CHECKING:
    from app.models.contract import Contract
    from app.models.advance_ledger import AdvanceLedgerEntry
    from app.models.statement import Statement
    from app.models.track_artist_link import TrackArtistLink


class Artist(Base):
    """Artist entity for royalty calculations."""

    __tablename__ = "artists"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Artist category (signed or collaborator)
    category: Mapped[str] = mapped_column(
        String(20),
        default=ArtistCategory.SIGNED.value,
        nullable=False,
    )

    # Optional external identifiers
    external_id: Mapped[str] = mapped_column(String(100), nullable=True, unique=True)

    # Spotify integration
    spotify_id: Mapped[str] = mapped_column(String(100), nullable=True)
    image_url: Mapped[str] = mapped_column(String(500), nullable=True)
    image_url_small: Mapped[str] = mapped_column(String(500), nullable=True)

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
    contracts: Mapped[List["Contract"]] = relationship(
        "Contract",
        back_populates="artist",
        cascade="all, delete-orphan",
    )
    advance_entries: Mapped[List["AdvanceLedgerEntry"]] = relationship(
        "AdvanceLedgerEntry",
        back_populates="artist",
        cascade="all, delete-orphan",
    )
    statements: Mapped[List["Statement"]] = relationship(
        "Statement",
        back_populates="artist",
        cascade="all, delete-orphan",
    )
    track_links: Mapped[List["TrackArtistLink"]] = relationship(
        "TrackArtistLink",
        back_populates="artist",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Artist {self.id} name={self.name}>"
