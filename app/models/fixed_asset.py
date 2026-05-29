"""Fixed assets (immobilisations) model for accounting/depreciation tracking.

Mirrors the structure used by the WHALES RECORDS chart of accounts:
PCG accounts 213xxx (constructions), 215400 (matériel studio), 215410
(matériel et outillage), 218100 (agencements), 218200 (transport),
218300 (matériel informatique). Duration is stored in months to match
the way the expert-comptable enters them.
"""
import uuid
from datetime import date, datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Date, DateTime, Integer, Numeric, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AssetCategory(str, Enum):
    """Functional category — drives default PCG account and useful life."""
    CONSTRUCTION = "construction"  # 213100 — gros œuvre studio
    STUDIO_GEAR = "studio_gear"    # 215400 — synthés, audio, instruments, vidéo
    TOOLING = "tooling"            # 215410 — outillage, équipements ménagers
    FITTINGS = "fittings"          # 218100 — installations générales, agencements
    VEHICLE = "vehicle"            # 218200 — matériel de transport
    COMPUTER = "computer"          # 218300 — matériel informatique, mobile, écrans
    SOFTWARE = "software"          # 205    — logiciels
    OTHER = "other"                # 2188   — autres


# Default PCG account per category
PCG_DEFAULTS = {
    AssetCategory.CONSTRUCTION: "213100",
    AssetCategory.STUDIO_GEAR: "215400",
    AssetCategory.TOOLING: "215410",
    AssetCategory.FITTINGS: "218100",
    AssetCategory.VEHICLE: "218200",
    AssetCategory.COMPUTER: "218300",
    AssetCategory.SOFTWARE: "205000",
    AssetCategory.OTHER: "218800",
}


# Default useful life in months per category
DEFAULT_LIFE_MONTHS = {
    AssetCategory.CONSTRUCTION: 144,   # 12 ans
    AssetCategory.STUDIO_GEAR: 96,     # 8 ans
    AssetCategory.TOOLING: 60,         # 5 ans
    AssetCategory.FITTINGS: 36,        # 3 ans
    AssetCategory.VEHICLE: 60,         # 5 ans
    AssetCategory.COMPUTER: 36,        # 3 ans
    AssetCategory.SOFTWARE: 12,        # 1 an
    AssetCategory.OTHER: 60,           # 5 ans
}


class DepreciationMethod(str, Enum):
    """Amortissement linéaire ou dégressif."""
    LINEAR = "linear"
    DEGRESSIVE = "degressive"


class AssetStatus(str, Enum):
    ACTIVE = "active"          # En service
    DISPOSED = "disposed"      # Mis au rebut
    SOLD = "sold"              # Cédé


class FixedAsset(Base):
    """Single capital asset (immobilisation corporelle ou incorporelle)."""

    __tablename__ = "fixed_assets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[str] = mapped_column(
        SAEnum(AssetCategory, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=AssetCategory.OTHER,
    )
    pcg_account: Mapped[str] = mapped_column(String(10), nullable=False, default="218800")
    internal_ref: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    purchase_amount_ht: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    vat_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=20.0)

    useful_life_months: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    depreciation_method: Mapped[str] = mapped_column(
        SAEnum(DepreciationMethod, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=DepreciationMethod.LINEAR,
    )

    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    supplier: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    invoice_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        SAEnum(AssetStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=AssetStatus.ACTIVE,
    )
    disposal_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    disposal_amount: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )
