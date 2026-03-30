import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.artist import Artist


class ArtistToken(Base):
    """Persistent token for artist portal access code login."""

    __tablename__ = "artist_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    artist: Mapped["Artist"] = relationship("Artist")

    __table_args__ = (
        Index("idx_artist_tokens_expires", "expires_at"),
    )
