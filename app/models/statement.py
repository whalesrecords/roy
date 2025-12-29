"""Statement model for artist royalty statements."""
import uuid
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, Date, Numeric, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.artist import Artist
    from app.models.royalty_run import RoyaltyRun


class StatementStatus(str, Enum):
    """Status of a statement."""
    DRAFT = "draft"       # Generated but not finalized
    FINALIZED = "finalized"  # Locked and ready for payment
    PAID = "paid"         # Payment has been processed


class Statement(Base):
    """
    Artist royalty statement for a specific period/run.

    A statement summarizes an artist's royalties for a period,
    including gross amounts, recoupment, and net payable.
    """

    __tablename__ = "statements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Artist
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Royalty run reference
    royalty_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("royalty_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Period info (denormalized for quick access)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)

    # Currency
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)

    # Status
    status: Mapped[str] = mapped_column(
        SAEnum(StatementStatus),
        default=StatementStatus.DRAFT,
        nullable=False,
        index=True,
    )

    # Amounts
    gross_revenue: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        default=Decimal("0"),
        nullable=False,
    )
    artist_royalties: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        default=Decimal("0"),
        nullable=False,
    )
    label_royalties: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        default=Decimal("0"),
        nullable=False,
    )

    # Advance/recoupment
    advance_balance_before: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        default=Decimal("0"),
        nullable=False,
    )
    recouped: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        default=Decimal("0"),
        nullable=False,
    )
    advance_balance_after: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        default=Decimal("0"),
        nullable=False,
    )

    # Net payable
    net_payable: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        default=Decimal("0"),
        nullable=False,
    )

    # Statistics
    transaction_count: Mapped[int] = mapped_column(default=0, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    finalized_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Relationships
    artist: Mapped["Artist"] = relationship(
        "Artist",
        back_populates="statements",
    )
    royalty_run: Mapped["RoyaltyRun"] = relationship(
        "RoyaltyRun",
        back_populates="statements",
    )

    def __repr__(self) -> str:
        return f"<Statement {self.id} artist={self.artist_id} net_payable={self.net_payable}>"
