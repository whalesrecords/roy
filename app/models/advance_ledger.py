"""
Advance Ledger model for tracking advances and recoupments.

LEDGER CONVENTION:
- ADVANCE entries: positive amount (money given to artist as advance)
- RECOUPMENT entries: positive amount (money recovered from artist royalties)

BALANCE CALCULATION:
  advance_balance = sum(advances) - sum(recoupments)

  - balance > 0: Artist has unrecouped advance (owes money)
  - balance = 0: Artist is fully recouped
  - balance < 0: Should not happen (over-recouped)

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
    ADVANCE = "advance"         # Money given to artist
    RECOUPMENT = "recoupment"   # Money recovered from royalties


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

    # Artist relationship
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=False,
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

    # Description/notes
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # For advances: reference to source (e.g., contract ID, invoice number)
    reference: Mapped[str] = mapped_column(String(255), nullable=True)

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
