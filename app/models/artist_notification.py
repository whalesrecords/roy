"""Artist Notification model for artist-facing alerts."""
import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.artist import Artist


class ArtistNotificationType(str, Enum):
    """Type of artist notification."""
    PAYMENT_RECEIVED = "payment_received"  # Payment was sent by admin
    STATEMENT_READY = "statement_ready"  # New statement is available
    PROFILE_UPDATE_REQUIRED = "profile_update_required"  # Profile info needed
    TICKET_RESPONSE = "ticket_response"  # Admin responded to ticket
    NEW_RELEASE = "new_release"  # New release added to catalog
    PROMO_UPDATE = "promo_update"  # Promo campaign update


class ArtistNotification(Base):
    """Notification for artist portal."""

    __tablename__ = "artist_notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Artist this notification is for
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    notification_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    # Title and message
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Optional link to navigate to (e.g., /payments/123)
    link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Additional data as JSON string
    data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Read status
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )

    # Relationships
    artist: Mapped["Artist"] = relationship("Artist", back_populates="artist_notifications")

    def __repr__(self) -> str:
        return f"<ArtistNotification {self.id} type={self.notification_type} artist={self.artist_id}>"
