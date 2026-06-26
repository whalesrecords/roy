"""Label (tenant) model — multi-tenant foundation.

Each label is an isolated tenant. All tenant-scoped data carries a
``label_id``; admins are linked to labels through ``label_members``;
artists are linked through ``artist_labels`` (many-to-many, since an
artist may be shared between labels in a regroupement).
"""
import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LabelStatus(str, Enum):
    """Lifecycle of a label account."""
    PENDING = "pending"      # signed up, awaiting platform-admin moderation
    ACTIVE = "active"
    SUSPENDED = "suspended"


class Label(Base):
    """A label / tenant."""

    __tablename__ = "labels"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    # Human-readable, URL-safe key (unique). e.g. "whales-records".
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Branding
    logo_url: Mapped[str] = mapped_column(Text, nullable=True)
    logo_base64: Mapped[str] = mapped_column(Text, nullable=True)
    logo_dark_base64: Mapped[str] = mapped_column(Text, nullable=True)
    accent_color: Mapped[str] = mapped_column(String(16), nullable=True)

    # Lifecycle / plan
    status: Mapped[str] = mapped_column(
        String(20), default=LabelStatus.PENDING.value, nullable=False, index=True,
    )
    plan: Mapped[str] = mapped_column(String(40), default="free", nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Label {self.slug} status={self.status}>"
