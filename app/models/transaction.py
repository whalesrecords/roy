import uuid
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, DateTime, Date, Numeric, Integer, Enum as SAEnum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.import_model import Import
    from app.models.artist import Artist


class SaleType(str, Enum):
    """Normalized sale types."""
    STREAM = "stream"
    DOWNLOAD = "download"
    PHYSICAL = "physical"
    OTHER = "other"


class TransactionNormalized(Base):
    """Normalized transaction from any source."""

    __tablename__ = "transactions_normalized"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    import_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("imports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Matched entity references (populated by matching system)
    artist_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    release_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    track_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    # Source reference (original row number for debugging)
    source_row_number: Mapped[int] = mapped_column(Integer, nullable=True)

    # Core normalized fields
    artist_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    release_title: Mapped[str] = mapped_column(String(255), nullable=True)
    track_title: Mapped[str] = mapped_column(String(255), nullable=True)
    isrc: Mapped[str] = mapped_column(String(12), nullable=True, index=True)
    upc: Mapped[str] = mapped_column(String(14), nullable=True, index=True)

    # Geographic & type
    territory: Mapped[str] = mapped_column(String(3), nullable=True)  # ISO country code
    sale_type: Mapped[str] = mapped_column(
        SAEnum(SaleType),
        default=SaleType.OTHER,
        nullable=False,
    )
    original_sale_type: Mapped[str] = mapped_column(String(100), nullable=True)  # Keep original

    # Financial
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    gross_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(String(3), default="USD")

    # Period
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)

    # Store/platform info
    store_name: Mapped[str] = mapped_column(String(100), nullable=True)

    # Physical product info (for Bandcamp packages: CD, Vinyl, etc.)
    sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Stock Keeping Unit
    physical_format: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # "Compact Disc (CD)", "Vinyl LP", etc.

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    import_record: Mapped["Import"] = relationship(
        "Import",
        back_populates="transactions",
    )
    matched_artist: Mapped[Optional["Artist"]] = relationship(
        "Artist",
        foreign_keys=[artist_id],
    )

    def __repr__(self) -> str:
        return f"<Transaction {self.id} artist={self.artist_name} amount={self.gross_amount}>"
