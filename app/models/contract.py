"""Contract model for royalty splits."""
import uuid
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, Date, Numeric, ForeignKey, CheckConstraint, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.artist import Artist
    from app.models.contract_party import ContractParty


class ContractScope(str, Enum):
    """
    Contract scope determines priority for matching transactions.
    Priority order: track > release > catalog
    """
    TRACK = "track"       # Applies to specific track (via ISRC)
    RELEASE = "release"   # Applies to specific release (via UPC)
    CATALOG = "catalog"   # Applies to all artist's catalog


class Contract(Base):
    """
    Contract defining royalty splits between artist and label.

    Matching logic (by priority):
    1. scope='track': match on artist_id + track_id (ISRC)
    2. scope='release': match on artist_id + release_id (UPC)
    3. scope='catalog': match on artist_id only

    Validity:
    - Contract is valid for a transaction if:
      start_date <= transaction.period_end AND
      (end_date IS NULL OR end_date >= transaction.period_start)
    """

    __tablename__ = "contracts"

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

    # Contract scope and identifier
    scope: Mapped[str] = mapped_column(
        SAEnum(ContractScope, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    # For track scope: ISRC, for release scope: UPC, null for catalog
    scope_id: Mapped[str] = mapped_column(String(50), nullable=True, index=True)

    # Split percentages (must sum to 1.0)
    artist_share: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=4),  # 0.0000 to 1.0000
        nullable=False,
    )
    label_share: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=4),
        nullable=False,
    )

    # Validity period
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=True)  # null = no end

    # Metadata
    description: Mapped[str] = mapped_column(String(500), nullable=True)
    document_url: Mapped[str] = mapped_column(Text, nullable=True)  # PDF contract document

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
    artist: Mapped["Artist"] = relationship(
        "Artist",
        back_populates="contracts",
    )

    parties: Mapped[list["ContractParty"]] = relationship(
        "ContractParty",
        back_populates="contract",
        cascade="all, delete-orphan",
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "artist_share >= 0 AND artist_share <= 1",
            name="check_artist_share_range",
        ),
        CheckConstraint(
            "label_share >= 0 AND label_share <= 1",
            name="check_label_share_range",
        ),
        CheckConstraint(
            "artist_share + label_share = 1",
            name="check_shares_sum_to_one",
        ),
        CheckConstraint(
            "(scope = 'catalog' AND scope_id IS NULL) OR "
            "(scope IN ('track', 'release') AND scope_id IS NOT NULL)",
            name="check_scope_id_required",
        ),
    )

    def __repr__(self) -> str:
        return f"<Contract {self.id} artist={self.artist_id} scope={self.scope} share={self.artist_share}>"

    def is_valid_for_period(self, period_start: date, period_end: date) -> bool:
        """Check if contract is valid for given period."""
        if self.start_date > period_end:
            return False
        if self.end_date is not None and self.end_date < period_start:
            return False
        return True
