"""Ticket participant model for multi-artist tickets."""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlalchemy import DateTime, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


if TYPE_CHECKING:
    from app.models.ticket import Ticket
    from app.models.artist import Artist


class TicketParticipant(Base):
    """Artists participating in a ticket (for multi-artist messaging)."""

    __tablename__ = "ticket_participants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Read tracking per participant
    last_read_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Notifications enabled for this participant
    notifications_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    ticket: Mapped["Ticket"] = relationship(
        "Ticket",
        back_populates="participants",
    )
    artist: Mapped["Artist"] = relationship("Artist")

    # Unique constraint: one participant record per artist per ticket
    __table_args__ = (
        UniqueConstraint('ticket_id', 'artist_id', name='uq_ticket_participant'),
    )

    def __repr__(self) -> str:
        return f"<TicketParticipant ticket={self.ticket_id} artist={self.artist_id}>"
