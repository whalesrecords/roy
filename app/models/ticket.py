"""Ticket model for artist-admin support system."""
import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class TicketStatus(str, Enum):
    """Status of a support ticket."""
    OPEN = "open"  # New ticket, not yet addressed
    IN_PROGRESS = "in_progress"  # Admin is working on it
    RESOLVED = "resolved"  # Issue resolved, awaiting confirmation
    CLOSED = "closed"  # Ticket closed/archived


class TicketCategory(str, Enum):
    """Category/theme of the ticket."""
    PAYMENT = "payment"  # Payment issues, delays, etc.
    PROFILE = "profile"  # Profile updates, bank details
    TECHNICAL = "technical"  # Technical issues with platform
    ROYALTIES = "royalties"  # Questions about royalty calculations
    CONTRACTS = "contracts"  # Contract-related questions
    CATALOG = "catalog"  # Release/track information
    GENERAL = "general"  # General inquiries
    OTHER = "other"  # Other topics


class TicketPriority(str, Enum):
    """Priority level of ticket."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


if TYPE_CHECKING:
    from app.models.artist import Artist
    from app.models.ticket_message import TicketMessage
    from app.models.ticket_participant import TicketParticipant


class Ticket(Base):
    """Support ticket for artist-admin communication."""

    __tablename__ = "tickets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Reference number for easy lookup (e.g., TKT-001234)
    ticket_number: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        unique=True,
        index=True,
    )

    # Subject/title
    subject: Mapped[str] = mapped_column(String(255), nullable=False)

    # Category
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    # Status
    status: Mapped[str] = mapped_column(
        String(20),
        default=TicketStatus.OPEN.value,
        nullable=False,
        index=True,
    )

    # Priority
    priority: Mapped[str] = mapped_column(
        String(20),
        default=TicketPriority.MEDIUM.value,
        nullable=False,
    )

    # Created by artist (nullable for admin-initiated or multi-artist tickets)
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Assigned to (for future admin assignment feature)
    assigned_to: Mapped[str] = mapped_column(String(100), nullable=True)

    # Last activity tracking
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )

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
    resolved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    closed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Relationships
    artist: Mapped[Optional["Artist"]] = relationship(
        "Artist",
        back_populates="tickets",
    )
    messages: Mapped[List["TicketMessage"]] = relationship(
        "TicketMessage",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="TicketMessage.created_at",
    )
    participants: Mapped[List["TicketParticipant"]] = relationship(
        "TicketParticipant",
        back_populates="ticket",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Ticket {self.ticket_number} status={self.status}>"
