"""Pydantic schemas for royalties API."""
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from typing import List, Optional

from pydantic import BaseModel, Field


# Request schemas

class RoyaltyRunCreate(BaseModel):
    """Request schema for creating a royalty run."""
    period_start: date = Field(description="Start of the royalty period (inclusive)")
    period_end: date = Field(description="End of the royalty period (inclusive)")
    base_currency: str = Field(default="USD", description="Base currency for calculations")
    artist_ids: Optional[List[UUID]] = Field(default=None, description="Optional list of artist IDs to include. If None, includes all artists.")


class StatementCreate(BaseModel):
    """Request schema for creating a statement for an artist."""
    artist_id: UUID
    period_start: date = Field(description="Start of the statement period")
    period_end: date = Field(description="End of the statement period")
    currency: str = Field(default="EUR")
    gross_revenue: Decimal = Field(description="Total gross revenue")
    artist_royalties: Decimal = Field(description="Artist's share of royalties")
    label_royalties: Decimal = Field(default=Decimal("0"), description="Label's share")
    advance_balance: Decimal = Field(default=Decimal("0"), description="Advance balance before recoupment")
    recouped: Decimal = Field(default=Decimal("0"), description="Amount recouped")
    net_payable: Decimal = Field(description="Net amount payable to artist")
    transaction_count: int = Field(default=0)
    finalize: bool = Field(default=True, description="Finalize the statement immediately")


# Response schemas

class ArtistRoyaltyResult(BaseModel):
    """Royalty result for a single artist."""
    artist_id: UUID
    artist_name: str
    gross: Decimal = Field(description="Total gross revenue in base currency")
    artist_royalties: Decimal = Field(description="Artist's share of royalties")
    recouped: Decimal = Field(description="Amount recouped from advance")
    net_payable: Decimal = Field(description="Net amount payable to artist")
    transaction_count: int = Field(description="Number of transactions processed")

    class Config:
        from_attributes = True


class RoyaltyRunResponse(BaseModel):
    """Response schema for a royalty run."""
    run_id: UUID
    period_start: date
    period_end: date
    base_currency: str
    status: str
    is_locked: bool
    total_transactions: int
    total_gross: Decimal
    total_artist_royalties: Decimal
    total_label_royalties: Decimal
    total_recouped: Decimal
    total_net_payable: Decimal
    artists: List[ArtistRoyaltyResult] = Field(default_factory=list)
    import_ids: List[UUID] = Field(
        default_factory=list,
        description="IDs of imports processed in this run"
    )
    created_at: datetime
    completed_at: Optional[datetime] = None
    locked_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RoyaltyRunSummary(BaseModel):
    """Summary response for royalty run (without artist details)."""
    run_id: UUID
    period_start: date
    period_end: date
    base_currency: str
    status: str
    is_locked: bool
    total_transactions: int
    total_gross: Decimal
    total_net_payable: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class StatementResponse(BaseModel):
    """Response schema for an artist statement."""
    id: UUID
    artist_id: UUID
    royalty_run_id: UUID
    period_start: date
    period_end: date
    currency: str
    status: str
    gross_revenue: Decimal = Field(description="Total gross revenue")
    artist_royalties: Decimal = Field(description="Artist's share of royalties")
    label_royalties: Decimal = Field(description="Label's share of royalties")
    advance_balance_before: Decimal = Field(description="Advance balance before recoupment")
    recouped: Decimal = Field(description="Amount recouped in this period")
    advance_balance_after: Decimal = Field(description="Advance balance after recoupment")
    net_payable: Decimal = Field(description="Net amount payable to artist")
    transaction_count: int
    created_at: datetime
    finalized_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StatementsListResponse(BaseModel):
    """Response schema for list of statements."""
    artist_id: UUID
    statements: List[StatementResponse]
    total_count: int

    class Config:
        from_attributes = True


# Artist schemas

class ArtistCreate(BaseModel):
    """Request schema for creating an artist."""
    name: str = Field(min_length=1, max_length=255)
    external_id: Optional[str] = Field(default=None, max_length=100)


class ArtistResponse(BaseModel):
    """Response schema for an artist."""
    id: UUID
    name: str
    category: str = "signed"  # 'signed' or 'collaborator'
    external_id: Optional[str] = None
    spotify_id: Optional[str] = None
    image_url: Optional[str] = None
    image_url_small: Optional[str] = None
    access_code: Optional[str] = None
    email: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Contract schemas

class ContractCreate(BaseModel):
    """Request schema for creating a contract."""
    artist_id: UUID
    scope: str = Field(description="Contract scope: 'track', 'release', or 'catalog'")
    scope_id: Optional[str] = Field(
        default=None,
        description="ISRC for track, UPC for release, null for catalog"
    )
    artist_share: Decimal = Field(ge=0, le=1, description="Artist share (0.0 to 1.0)")
    label_share: Decimal = Field(ge=0, le=1, description="Label share (0.0 to 1.0)")
    start_date: date
    end_date: Optional[date] = None
    description: Optional[str] = None


class ContractResponse(BaseModel):
    """Response schema for a contract."""
    id: UUID
    artist_id: UUID
    scope: str
    scope_id: Optional[str]
    artist_share: Decimal
    label_share: Decimal
    start_date: date
    end_date: Optional[date]
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Advance ledger schemas

class AdvanceCreate(BaseModel):
    """Request schema for creating an advance entry."""
    artist_id: UUID
    amount: Decimal = Field(gt=0, description="Advance amount (positive)")
    currency: str = Field(default="EUR")
    scope: str = Field(default="catalog", description="Advance scope: 'track', 'release', or 'catalog'")
    scope_id: Optional[str] = Field(
        default=None,
        description="ISRC for track, UPC for release, null for catalog"
    )
    category: Optional[str] = Field(
        default=None,
        description="Expense category: mastering, mixing, recording, photos, video, advertising, groover, submithub, google_ads, instagram, tiktok, facebook, spotify_ads, pr, distribution, artwork, cd, vinyl, goodies, other"
    )
    description: Optional[str] = None
    reference: Optional[str] = None


class AdvanceLedgerEntryResponse(BaseModel):
    """Response schema for an advance ledger entry."""
    id: UUID
    artist_id: Optional[UUID] = None
    artist_name: Optional[str] = None
    entry_type: str
    amount: Decimal
    currency: str
    scope: str = Field(default="catalog")
    scope_id: Optional[str] = None
    category: Optional[str] = None
    royalty_run_id: Optional[UUID] = None
    description: Optional[str] = None
    reference: Optional[str] = None
    document_url: Optional[str] = None
    effective_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class AdvanceBalanceResponse(BaseModel):
    """Response schema for advance balance."""
    artist_id: UUID
    balance: Decimal = Field(description="Current advance balance (positive = unrecouped)")
    currency: str
    total_advances: Decimal = Field(default=Decimal("0"), description="Total advances given to artist")
    total_recouped: Decimal = Field(default=Decimal("0"), description="Total already recouped from royalties")
    total_payments: Decimal = Field(default=Decimal("0"), description="Total royalty payments made to artist")


# Payment schemas

class PaymentCreate(BaseModel):
    """Request schema for recording a payment to an artist."""
    artist_id: UUID
    amount: Decimal = Field(gt=0, description="Payment amount (positive)")
    currency: str = Field(default="EUR")
    description: Optional[str] = Field(default=None, description="Payment description/reference")
    payment_date: Optional[date] = Field(default=None, description="Date of payment (defaults to today)")


class PaymentUpdate(BaseModel):
    """Request schema for updating a payment."""
    amount: Optional[Decimal] = Field(default=None, gt=0, description="Payment amount (positive)")
    description: Optional[str] = Field(default=None, description="Payment description/reference")
    payment_date: Optional[date] = Field(default=None, description="Date of payment")
