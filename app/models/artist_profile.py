"""Artist Profile model for storing artist contact and bank information."""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.artist import Artist


class ArtistProfile(Base):
    """Artist profile with contact and bank information."""

    __tablename__ = "artist_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # Contact information
    email: Mapped[str] = mapped_column(String(255), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)

    # Address
    address_line1: Mapped[str] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[str] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str] = mapped_column(String(20), nullable=True)
    country: Mapped[str] = mapped_column(String(100), nullable=True)

    # Bank details
    bank_name: Mapped[str] = mapped_column(String(255), nullable=True)
    account_holder: Mapped[str] = mapped_column(String(255), nullable=True)
    iban: Mapped[str] = mapped_column(String(50), nullable=True)
    bic: Mapped[str] = mapped_column(String(20), nullable=True)

    # Legal information
    siret: Mapped[str] = mapped_column(String(20), nullable=True)
    vat_number: Mapped[str] = mapped_column(String(30), nullable=True)

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

    # Relationship
    artist: Mapped["Artist"] = relationship("Artist", back_populates="profile")

    def __repr__(self) -> str:
        return f"<ArtistProfile {self.id} artist_id={self.artist_id}>"
