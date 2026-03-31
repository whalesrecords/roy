import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.transaction import TransactionNormalized


class ImportSource(str, Enum):
    """Supported import sources."""
    TUNECORE = "tunecore"
    BELIEVE_UK = "believe_uk"
    BELIEVE_FR = "believe_fr"
    CDBABY = "cdbaby"
    BANDCAMP = "bandcamp"
    SQUARESPACE = "squarespace"
    SUBMITHUB = "submithub"
    GROOVER = "groover"
    DETAILSDETAILS = "detailsdetails"
    OTHER = "other"


class ImportStatus(str, Enum):
    """Import processing status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"  # Some rows failed


class Import(Base):
    """Represents a CSV import operation."""

    __tablename__ = "imports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default=ImportStatus.PENDING.value,
        nullable=False,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)

    # Statistics
    rows_total: Mapped[int] = mapped_column(Integer, default=0)
    rows_parsed: Mapped[int] = mapped_column(Integer, default=0)
    rows_inserted: Mapped[int] = mapped_column(Integer, default=0)
    errors_count: Mapped[int] = mapped_column(Integer, default=0)
    gross_total: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=6),
        default=Decimal("0"),
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Relationships
    transactions: Mapped[list["TransactionNormalized"]] = relationship(
        "TransactionNormalized",
        back_populates="import_record",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Import {self.id} source={self.source} status={self.status}>"
