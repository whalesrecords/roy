"""Ticket message model for conversation threads."""
import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class MessageSender(str, Enum):
    """Who sent the message."""
    ARTIST = "artist"
    ADMIN = "admin"
    SYSTEM = "system"


if TYPE_CHECKING:
    from app.models.ticket import Ticket


class TicketMessage(Base):
    """Individual message in a ticket conversation."""

    __tablename__ = "ticket_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Reference to ticket
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Message content
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Sender type
    sender_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    # Sender reference (artist_id for artist, admin email/id for admin)
    sender_id: Mapped[str] = mapped_column(String(100), nullable=True)
    sender_name: Mapped[str] = mapped_column(String(255), nullable=True)

    # Internal note flag (only visible to admin)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Attachments (JSON array of file references)
    attachments: Mapped[str] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )

    # Relationships
    ticket: Mapped["Ticket"] = relationship(
        "Ticket",
        back_populates="messages",
    )

    def __repr__(self) -> str:
        return f"<TicketMessage {self.id} sender={self.sender_type}>"
