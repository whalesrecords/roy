"""Track Artist Link model for many-to-many relationship between tracks and artists."""
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, DateTime, Numeric, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class TrackArtistLink(Base):
    """
    Links artists to tracks with share percentages.

    For each track (ISRC), defines which artists participate
    and their respective share of the revenue.

    Example: Track "Song X" with ISRC "USRC12345678"
    - Artist A: 40% share
    - Artist B: 40% share
    - Remaining 20% goes to label via contracts
    """

    __tablename__ = "track_artist_links"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Track identifier
    isrc: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # Artist reference
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Share percentage (0.0000 to 1.0000)
    share_percent: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=4),
        nullable=False,
    )

    # Denormalized fields for display (populated from first matching transaction)
    track_title: Mapped[str] = mapped_column(String(500), nullable=True)
    release_title: Mapped[str] = mapped_column(String(500), nullable=True)
    upc: Mapped[str] = mapped_column(String(20), nullable=True)

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
    artist = relationship("Artist", back_populates="track_links")

    __table_args__ = (
        UniqueConstraint("isrc", "artist_id", name="uq_track_artist"),
        CheckConstraint(
            "share_percent > 0 AND share_percent <= 1",
            name="check_share_range"
        ),
    )

    def __repr__(self) -> str:
        return f"<TrackArtistLink isrc={self.isrc} artist_id={self.artist_id} share={self.share_percent}>"
