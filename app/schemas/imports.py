"""Pydantic schemas for imports API."""

from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ImportErrorDetail(BaseModel):
    """Detail of a single import error."""
    row_number: int
    error: str
    raw_data: Optional[Dict] = None


class ImportResponse(BaseModel):
    """Response schema for import endpoint."""
    import_id: UUID
    status: str
    rows_parsed: int = Field(description="Number of rows successfully parsed")
    rows_inserted: int = Field(description="Number of transactions inserted into DB")
    gross_total: Decimal = Field(description="Sum of all gross_amount values")
    errors_count: int = Field(description="Number of rows that failed parsing")
    sample_errors: List[ImportErrorDetail] = Field(
        default_factory=list,
        description="First 10 parsing errors for debugging",
    )

    class Config:
        from_attributes = True


class ImportStatusResponse(BaseModel):
    """Response schema for import status check."""
    import_id: UUID
    source: str
    status: str
    filename: Optional[str]
    period_start: date
    period_end: date
    rows_total: int
    rows_parsed: int
    rows_inserted: int
    errors_count: int
    gross_total: Decimal
    created_at: str
    completed_at: Optional[str]

    class Config:
        from_attributes = True


class ImportListItem(BaseModel):
    """Item in the imports list."""
    id: UUID
    source: str
    status: str
    period_start: date
    period_end: date
    filename: Optional[str]
    total_rows: int
    success_rows: int
    error_rows: int
    errors: List[ImportErrorDetail] = Field(default_factory=list)
    created_at: str

    class Config:
        from_attributes = True


class PreviewRow(BaseModel):
    """A single row in the preview."""
    pass  # Dynamic dict


class PreviewResponse(BaseModel):
    """Response for import preview."""
    columns: List[str]
    rows: List[Dict]
    total_rows: int


class ColumnMapping(BaseModel):
    """Mapping of a source column to a normalized field."""
    source_column: str
    target_field: Optional[str] = None


class MappingRequest(BaseModel):
    """Request to save column mappings."""
    mappings: List[ColumnMapping]


class MappingResponse(BaseModel):
    """Response after saving mappings."""
    success: bool
