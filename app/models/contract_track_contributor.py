"""Per-track contributor royalty splits within a contract (documentation / registry).

Lets a contract scoped to a release list each track and record, per track, the
contributors (composers, musicians, performers…) with their royalty percentage.
This is a record-keeping layer: it does not (yet) drive the payout engine.
"""
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ContractTrackContributor(Base):
    __tablename__ = "contract_track_contributors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Track this contributor applies to (ISRC). Null = applies to the whole contract.
    isrc: Mapped[str] = mapped_column(String(50), nullable=True, index=True)
    track_title: Mapped[str] = mapped_column(String(300), nullable=True)

    contributor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(40), nullable=True)  # composer, author, musician, performer, producer, …
    # Percentage as entered (0–100). Documentation only — does not affect the payout engine.
    percentage: Mapped[Decimal] = mapped_column(Numeric(precision=6, scale=3), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ContractTrackContributor {self.contributor_name} {self.role} {self.percentage}%>"
