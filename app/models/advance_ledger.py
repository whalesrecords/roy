"""
Advance Ledger model for tracking advances, recoupments, and payments.

LEDGER CONVENTION:
- ADVANCE entries: positive amount (money given to artist as advance)
- RECOUPMENT entries: positive amount (money recovered from artist royalties)
- PAYMENT entries: positive amount (royalties paid to artist by the label)

BALANCE CALCULATION:
  advance_balance = sum(advances) - sum(recoupments)

  - balance > 0: Artist has unrecouped advance (owes money)
  - balance = 0: Artist is fully recouped
  - balance < 0: Should not happen (over-recouped)

PAYMENT TRACKING:
  Payments represent actual money transferred to the artist.
  After a payment, the "net payable" resets for new calculations.
  total_paid = sum(payments)

RECOUPMENT RULE:
  On each royalty run:
  recouped = min(total_artist_royalties, advance_balance)
  net_payable = total_artist_royalties - recouped
"""
import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, Numeric, ForeignKey, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.artist import Artist
    from app.models.royalty_run import RoyaltyRun


class LedgerEntryType(str, Enum):
    """Type of ledger entry."""
    ADVANCE = "advance"         # Money given to artist as advance
    RECOUPMENT = "recoupment"   # Money recovered from royalties
    PAYMENT = "payment"         # Royalties paid to artist by label


class ExpenseCategory(str, Enum):
    """Category of expense/advance."""
    MASTERING = "mastering"
    MIXING = "mixing"
    RECORDING = "recording"
    PHOTOS = "photos"
    VIDEO = "video"
    ADVERTISING = "advertising"
    GROOVER = "groover"
    SUBMITHUB = "submithub"
    GOOGLE_ADS = "google_ads"
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"
    FACEBOOK = "facebook"
    SPOTIFY_ADS = "spotify_ads"
    PR = "pr"
    DISTRIBUTION = "distribution"
    ARTWORK = "artwork"
    CD = "cd"
    VINYL = "vinyl"
    GOODIES = "goodies"
    ACCOMMODATION = "accommodation"
    EQUIPMENT_RENTAL = "equipment_rental"
    OTHER = "other"


class AdvanceLedgerEntry(Base):
    """
    Ledger entry for tracking advances and recoupments.

    Each entry is a positive amount with a type indicating
    whether it's an advance or recoupment.
    """

    __tablename__ = "advance_ledger"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Artist relationship (nullable for track/release-level advances shared by all collaborators)
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=True,  # NULL = advance on track/release itself, shared by all artists
        index=True,
    )

    # Scope: track, release, or catalog (default=catalog means applies to all)
    scope: Mapped[str] = mapped_column(
        String(20),
        default="catalog",
        nullable=False,
    )
    scope_id: Mapped[str] = mapped_column(
        String(50),
        nullable=True,
    )

    # Entry type and amount
    entry_type: Mapped[str] = mapped_column(
        SAEnum(LedgerEntryType),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)

    # Optional reference to royalty run (for recoupment entries)
    royalty_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("royalty_runs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Expense category (for advances)
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )

    # Description/notes
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # For advances: reference to source (e.g., contract ID, invoice number)
    reference: Mapped[str] = mapped_column(String(255), nullable=True)

    # Document/invoice URL (PDF stored as base64 data URL)
    document_url: Mapped[str] = mapped_column(Text, nullable=True)

    # Timestamps
    effective_date: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    artist: Mapped["Artist"] = relationship(
        "Artist",
        back_populates="advance_entries",
    )
    royalty_run: Mapped["RoyaltyRun"] = relationship(
        "RoyaltyRun",
        back_populates="recoupment_entries",
    )

    def __repr__(self) -> str:
        return f"<AdvanceLedgerEntry {self.id} type={self.entry_type} amount={self.amount}>"
