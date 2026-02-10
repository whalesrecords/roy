"""Contract Party model for managing multiple artists and labels in contracts."""
import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, Numeric, ForeignKey, CheckConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.contract import Contract
    from app.models.artist import Artist


class PartyType(str, Enum):
    """Type of party in a contract."""
    ARTIST = "artist"
    LABEL = "label"


class ContractParty(Base):
    """
    Represents a party (artist or label) in a contract with their share percentage.

    A contract can have multiple parties:
    - Multiple artists (each with their share %)
    - Multiple labels (each with their share %)

    Example:
    - Artist A: 40%
    - Artist B: 10%
    - Label X: 30%
    - Label Y: 20%
    Total: 100%
    """

    __tablename__ = "contract_parties"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Contract relationship
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Party type
    party_type: Mapped[str] = mapped_column(
        SAEnum(PartyType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )

    # For artists: reference to artist
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # For labels: label name (simple string, no FK for now)
    label_name: Mapped[str] = mapped_column(String(200), nullable=True)

    # Share percentage (0.0000 to 1.0000, i.e., 0% to 100%)
    # share_percentage = default / streams rate
    share_percentage: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=4),  # 0.0000 to 1.0000
        nullable=False,
    )
    # Physical sales rate (CD, vinyl, K7) - if NULL, uses share_percentage
    share_physical: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=4),
        nullable=True,
    )
    # Digital sales rate (downloads, Bandcamp digital) - if NULL, uses share_percentage
    share_digital: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=4),
        nullable=True,
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    contract: Mapped["Contract"] = relationship(
        "Contract",
        back_populates="parties",
    )

    artist: Mapped["Artist"] = relationship(
        "Artist",
        foreign_keys=[artist_id],
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "share_percentage >= 0 AND share_percentage <= 1",
            name="check_share_percentage_range",
        ),
        CheckConstraint(
            "(party_type = 'artist' AND artist_id IS NOT NULL AND label_name IS NULL) OR "
            "(party_type = 'label' AND label_name IS NOT NULL AND artist_id IS NULL)",
            name="check_party_type_consistency",
        ),
    )

    def __repr__(self) -> str:
        party_name = self.artist_id if self.party_type == PartyType.ARTIST else self.label_name
        return f"<ContractParty {self.id} type={self.party_type} party={party_name} share={self.share_percentage}>"
