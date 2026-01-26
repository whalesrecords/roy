"""Notification model for admin alerts."""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class NotificationType(str, Enum):
    """Type of notification."""
    PROFILE_UPDATE = "profile_update"  # Artist updated their profile
    PAYMENT_REQUEST = "payment_request"  # Artist requested payment
    NEW_ARTIST = "new_artist"  # New artist registered
    # Ticket notifications
    TICKET_CREATED = "ticket_created"  # New ticket created by artist
    TICKET_MESSAGE = "ticket_message"  # New message in ticket
    TICKET_UPDATED = "ticket_updated"  # Ticket status/priority updated
    TICKET_RESOLVED = "ticket_resolved"  # Ticket marked as resolved
    TICKET_CLOSED = "ticket_closed"  # Ticket closed


class Notification(Base):
    """Notification for admin dashboard."""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    notification_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    # Reference to artist if applicable
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=True,
    )

    # Title and message
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=True)

    # Additional data as JSON string
    data: Mapped[str] = mapped_column(Text, nullable=True)

    # Read status
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Notification {self.id} type={self.notification_type}>"
