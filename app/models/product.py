"""Product model for merch/physical inventory tracking."""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import String, DateTime, Integer, Numeric, Boolean, Text, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class ProductFormat(str, Enum):
    """Physical product format."""
    VINYL = "vinyl"
    CD = "cd"
    CASSETTE = "cassette"
    MERCH = "merch"
    BUNDLE = "bundle"
    OTHER = "other"


class ProductStatus(str, Enum):
    """Product availability status."""
    AVAILABLE = "available"
    SOLD_OUT = "sold_out"
    PREORDER = "preorder"
    DISCONTINUED = "discontinued"


class Product(Base):
    """Physical product in inventory (vinyl, CD, merch, etc.)."""

    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )

    # Product info
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    format: Mapped[str] = mapped_column(
        SAEnum(ProductFormat, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=ProductFormat.VINYL,
    )
    variant: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # e.g. "Black vinyl", "Red t-shirt XL"
    sku: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, unique=True)

    # Link to release (optional — merch may not have a release)
    release_upc: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    artist_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Pricing
    price_eur: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    cost_eur: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)  # Cost price

    # Stock
    stock_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=10)

    # Status
    status: Mapped[str] = mapped_column(
        SAEnum(ProductStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=ProductStatus.AVAILABLE,
    )

    # Limited edition
    limited_edition: Mapped[bool] = mapped_column(Boolean, default=False)
    edition_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Image
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Notes
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    stock_movements: Mapped[list["StockMovement"]] = relationship(
        "StockMovement", back_populates="product", cascade="all, delete-orphan",
    )


class MovementType(str, Enum):
    """Type of stock movement."""
    IN = "in"          # Restock / received
    OUT = "out"        # Sold / shipped
    ADJUSTMENT = "adjustment"  # Manual correction
    RETURN = "return"  # Customer return


class StockMovement(Base):
    """Tracks individual stock changes for audit trail."""

    __tablename__ = "stock_movements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    movement_type: Mapped[str] = mapped_column(
        SAEnum(MovementType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)  # Positive for in/return, negative for out
    reason: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)  # e.g. "Bandcamp order #1234", "Shopify"
    source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # bandcamp, shopify, squarespace, manual

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    product: Mapped["Product"] = relationship("Product", back_populates="stock_movements")
