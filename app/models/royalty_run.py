"""RoyaltyRun model for tracking royalty calculation runs."""
import uuid
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, List

from sqlalchemy import String, DateTime, Date, Numeric, Text, Boolean, Integer, JSON
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.royalty_line_item import RoyaltyLineItem
    from app.models.statement import Statement
    from app.models.advance_ledger import AdvanceLedgerEntry


class RoyaltyRunStatus(str, Enum):
    """Status of a royalty run."""
    DRAFT = "draft"           # Initial state, can be modified
    PROCESSING = "processing"  # Calculation in progress
    COMPLETED = "completed"    # Calculation done, not yet locked
    LOCKED = "locked"         # Finalized, no modifications allowed
    FAILED = "failed"         # Calculation failed


class RoyaltyRun(Base):
    """
    A royalty calculation run for a specific period.

    A run processes all transactions in the period, applies contracts,
    calculates artist royalties, and handles advance recoupment.

    Audit trail:
    - References import IDs that were used
    - Records period and currency parameters
    - Stores aggregated totals for quick access
    """

    __tablename__ = "royalty_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Run parameters
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    base_currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)

    # Status
    status: Mapped[str] = mapped_column(
        SAEnum(RoyaltyRunStatus),
        default=RoyaltyRunStatus.DRAFT,
        nullable=False,
        index=True,
    )
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Audit: track which imports were processed (stored as JSON list of UUID strings)
    import_ids: Mapped[List[str]] = mapped_column(
        JSON,
        nullable=True,
    )

    # Aggregated totals (for quick access without querying line items)
    total_transactions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_gross: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        default=Decimal("0"),
        nullable=False,
    )
    total_artist_royalties: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        default=Decimal("0"),
        nullable=False,
    )
    total_label_royalties: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        default=Decimal("0"),
        nullable=False,
    )
    total_recouped: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        default=Decimal("0"),
        nullable=False,
    )
    total_net_payable: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        default=Decimal("0"),
        nullable=False,
    )

    # Processing info
    error_message: Mapped[str] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    locked_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Relationships
    line_items: Mapped[List["RoyaltyLineItem"]] = relationship(
        "RoyaltyLineItem",
        back_populates="royalty_run",
        cascade="all, delete-orphan",
    )
    statements: Mapped[List["Statement"]] = relationship(
        "Statement",
        back_populates="royalty_run",
        cascade="all, delete-orphan",
    )
    recoupment_entries: Mapped[List["AdvanceLedgerEntry"]] = relationship(
        "AdvanceLedgerEntry",
        back_populates="royalty_run",
    )

    def __repr__(self) -> str:
        return f"<RoyaltyRun {self.id} period={self.period_start}-{self.period_end} status={self.status}>"
