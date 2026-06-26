"""ArtistLabel — many-to-many link between artists and labels.

An artist can belong to more than one label (regroupement / shared
artist). Label-specific *data* (contracts, statements, royalties…) is
still isolated per label via each row's ``label_id``; this table only
records which labels an artist entity is associated with.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ArtistLabel(Base):
    """Association of an artist with a label."""

    __tablename__ = "artist_labels"
    __table_args__ = (
        UniqueConstraint("label_id", "artist_id", name="uq_artist_label"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    label_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("labels.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ArtistLabel artist={self.artist_id} label={self.label_id}>"
