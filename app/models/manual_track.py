"""Manual catalog track model."""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.manual_release import ManualRelease


class ManualTrack(Base):
    """Manually-registered track, optionally attached to a ManualRelease."""

    __tablename__ = "manual_tracks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    isrc: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    release_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("manual_releases.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # Track number within release
    position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Duration in seconds
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    release: Mapped[Optional["ManualRelease"]] = relationship("ManualRelease", back_populates="tracks")
