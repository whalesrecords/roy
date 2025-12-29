"""Match Suggestion model for transaction correlation."""
import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.transaction import TransactionNormalized
    from app.models.artist import Artist


class MatchMethod(str, Enum):
    """Method used for matching."""
    ISRC = "isrc"
    UPC = "upc"
    FUZZY_TITLE = "fuzzy_title"
    FUZZY_ARTIST = "fuzzy_artist"


class MatchStatus(str, Enum):
    """Status of a match suggestion."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class MatchSuggestion(Base):
    """
    Stores match suggestions for transactions.

    Each suggestion represents a potential match between a transaction
    and canonical entities (artist, release, track).
    """

    __tablename__ = "match_suggestions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Transaction reference
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transactions_normalized.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Candidate matches (nullable)
    candidate_artist_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    candidate_release_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    candidate_track_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    # Match quality
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    method: Mapped[str] = mapped_column(String(50), nullable=False)

    # Status
    status: Mapped[str] = mapped_column(
        String(20),
        default=MatchStatus.PENDING.value,
        nullable=False,
        index=True,
    )

    # Resolution tracking
    resolved_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    transaction: Mapped["TransactionNormalized"] = relationship(
        "TransactionNormalized",
        foreign_keys=[transaction_id],
    )
    candidate_artist: Mapped[Optional["Artist"]] = relationship(
        "Artist",
        foreign_keys=[candidate_artist_id],
    )

    def __repr__(self) -> str:
        return f"<MatchSuggestion {self.id} tx={self.transaction_id} score={self.score} status={self.status}>"
