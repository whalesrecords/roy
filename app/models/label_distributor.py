"""LabelDistributor — distributors & tools declared by a label at signup.

A single parameterised table; ``kind`` discriminates between
digital / physical / online-sales distributors and tools.
"""
import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DistributorKind(str, Enum):
    DIGITAL = "digital"            # streaming / download aggregators
    PHYSICAL = "physical"          # CD / vinyl
    ONLINE_SALES = "online_sales"  # D2C stores & marketplaces
    TOOL = "tool"                  # promo / analytics / smartlinks


class LabelDistributor(Base):
    """A distributor or tool used by a label."""

    __tablename__ = "label_distributors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    label_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("labels.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_ref: Mapped[str] = mapped_column(String(200), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False,
    )

    def __repr__(self) -> str:
        return f"<LabelDistributor {self.kind}:{self.name} label={self.label_id}>"
