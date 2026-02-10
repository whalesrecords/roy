"""Schemas for contracts and contract parties."""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class PartyBase(BaseModel):
    """Base schema for a contract party."""
    party_type: str = Field(..., description="Type of party: 'artist' or 'label'")
    artist_id: Optional[UUID] = Field(None, description="Artist ID if party_type is 'artist'")
    label_name: Optional[str] = Field(None, max_length=200, description="Label name if party_type is 'label'")
    share_percentage: Decimal = Field(..., ge=0, le=1, description="Share percentage (0.0 to 1.0) - default/streams rate")
    share_physical: Optional[Decimal] = Field(None, ge=0, le=1, description="Physical sales rate (CD, vinyl, K7) - if null, uses share_percentage")
    share_digital: Optional[Decimal] = Field(None, ge=0, le=1, description="Digital sales rate (downloads) - if null, uses share_percentage")

    @field_validator('share_percentage')
    @classmethod
    def validate_share(cls, v):
        if v < 0 or v > 1:
            raise ValueError("Share percentage must be between 0 and 1")
        return v

    @field_validator('party_type')
    @classmethod
    def validate_party_type(cls, v):
        if v not in ['artist', 'label']:
            raise ValueError("party_type must be 'artist' or 'label'")
        return v


class PartyCreate(PartyBase):
    """Schema for creating a contract party."""
    pass


class PartyUpdate(BaseModel):
    """Schema for updating a contract party."""
    share_percentage: Optional[Decimal] = Field(None, ge=0, le=1)
    share_physical: Optional[Decimal] = Field(None, ge=0, le=1)
    share_digital: Optional[Decimal] = Field(None, ge=0, le=1)


class PartyResponse(PartyBase):
    """Schema for contract party response."""
    id: UUID
    contract_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class ContractBase(BaseModel):
    """Base schema for a contract."""
    scope: str = Field(..., description="Contract scope: 'track', 'release', or 'catalog'")
    scope_id: Optional[str] = Field(None, max_length=50, description="ISRC for track, UPC for release, null for catalog")
    start_date: date = Field(..., description="Contract start date")
    end_date: Optional[date] = Field(None, description="Contract end date (null = no end)")
    description: Optional[str] = Field(None, max_length=500)

    @field_validator('scope')
    @classmethod
    def validate_scope(cls, v):
        if v not in ['track', 'release', 'catalog']:
            raise ValueError("scope must be 'track', 'release', or 'catalog'")
        return v


class ContractCreate(ContractBase):
    """Schema for creating a contract with parties."""
    artist_id: UUID = Field(..., description="Primary artist ID for the contract")
    parties: list[PartyCreate] = Field(..., description="List of parties (artists and labels)")

    @field_validator('parties')
    @classmethod
    def validate_parties(cls, v):
        if not v:
            raise ValueError("At least one party is required")

        # Check that shares sum to 1.0 (100%)
        total_share = sum(party.share_percentage for party in v)
        if abs(total_share - Decimal('1.0')) > Decimal('0.0001'):  # Allow small floating point errors
            raise ValueError(f"Parties' share percentages must sum to 1.0 (100%), got {total_share}")

        return v


class ContractUpdate(BaseModel):
    """Schema for updating a contract."""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = Field(None, max_length=500)
    parties: Optional[list[PartyCreate]] = None

    @field_validator('parties')
    @classmethod
    def validate_parties(cls, v):
        if v is not None:
            if not v:
                raise ValueError("At least one party is required")

            # Check that shares sum to 1.0 (100%)
            total_share = sum(party.share_percentage for party in v)
            if abs(total_share - Decimal('1.0')) > Decimal('0.0001'):
                raise ValueError(f"Parties' share percentages must sum to 1.0 (100%), got {total_share}")

        return v


class ContractResponse(ContractBase):
    """Schema for contract response."""
    id: UUID
    artist_id: UUID
    document_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    parties: list[PartyResponse] = Field(default_factory=list)

    # Legacy fields for backward compatibility
    artist_share: Optional[Decimal] = None
    label_share: Optional[Decimal] = None

    class Config:
        from_attributes = True


class ContractListItem(BaseModel):
    """Schema for contract list item (simplified)."""
    id: UUID
    artist_id: UUID
    scope: str
    scope_id: Optional[str]
    start_date: date
    end_date: Optional[date]
    parties: list[PartyResponse]
    # Legacy fields for backward compatibility with old contracts
    artist_share: Optional[Decimal] = None
    label_share: Optional[Decimal] = None

    class Config:
        from_attributes = True
