"""RoyaltyLineItem model for individual transaction calculations."""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.royalty_run import RoyaltyRun
    from app.models.contract import Contract


class RoyaltyLineItem(Base):
    """
    Individual line item in a royalty run.

    Each line item represents the calculation for a single transaction,
    recording which contract was applied and the resulting amounts.
    """

    __tablename__ = "royalty_line_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Parent run
    royalty_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("royalty_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Source transaction reference
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transactions_normalized.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Contract applied (null if no contract found - uses default)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Artist info (denormalized for reporting)
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    artist_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Track/Release info (denormalized for reporting)
    track_title: Mapped[str] = mapped_column(String(255), nullable=True)
    release_title: Mapped[str] = mapped_column(String(255), nullable=True)
    isrc: Mapped[str] = mapped_column(String(12), nullable=True)
    upc: Mapped[str] = mapped_column(String(14), nullable=True)

    # Original amounts
    gross_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        nullable=False,
    )
    original_currency: Mapped[str] = mapped_column(String(3), nullable=False)

    # Converted to base currency
    amount_base: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        nullable=False,
    )
    fx_rate: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        default=Decimal("1"),
        nullable=False,
    )

    # Applied splits
    artist_share: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=4),
        nullable=False,
    )
    label_share: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=4),
        nullable=False,
    )

    # Calculated amounts
    artist_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        nullable=False,
    )
    label_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        nullable=False,
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    royalty_run: Mapped["RoyaltyRun"] = relationship(
        "RoyaltyRun",
        back_populates="line_items",
    )
    contract: Mapped["Contract"] = relationship("Contract")

    def __repr__(self) -> str:
        return f"<RoyaltyLineItem {self.id} artist={self.artist_name} amount={self.artist_amount}>"
