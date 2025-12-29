"""
TuneCore CSV Parser

Parses TuneCore music sales reports. Tolerant to minor column variations.
Returns raw parsed data for normalization.
"""

import csv
import io
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Dict, Iterator, List, Optional, Union


@dataclass
class TuneCoreRow:
    """Raw parsed row from TuneCore CSV."""
    row_number: int
    artist: str
    release_title: str
    song_title: str
    isrc: Optional[str]
    upc: Optional[str]
    country_of_sale: Optional[str]
    sales_type: Optional[str]
    units_sold: int
    total_earned: Decimal
    currency: str
    sales_period: str  # Raw value, to be parsed later
    store_name: Optional[str] = None


@dataclass
class ParseError:
    """Represents a parsing error for a specific row."""
    row_number: int
    error: str
    raw_data: Optional[Dict] = None


@dataclass
class TuneCoreParseResult:
    """Result of parsing a TuneCore CSV."""
    rows: List[TuneCoreRow] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)
    total_rows: int = 0


# Column name mappings - tolerant to minor variations
COLUMN_MAPPINGS = {
    "artist": ["artist", "artist name", "artist_name"],
    "release_title": ["release title", "release_title", "album", "album title"],
    "song_title": ["song title", "song_title", "track", "track title", "track_title"],
    "isrc": ["optional isrc", "isrc", "optional_isrc"],
    "upc": ["upc", "upc code", "upc_code"],
    "country_of_sale": ["country of sale", "country_of_sale", "country", "territory"],
    "sales_type": ["sales type", "sales_type", "type", "sale type"],
    "units_sold": ["# units sold", "units sold", "units_sold", "quantity", "# units"],
    "total_earned": ["total earned", "total_earned", "earnings", "amount", "net"],
    "currency": ["currency", "currency code"],
    "sales_period": ["sales period", "sales_period", "period", "reporting period"],
    "store_name": ["store", "store name", "store_name", "dsp", "service"],
}


def _find_column_index(headers: List[str], field_name: str) -> Optional[int]:
    """Find column index by trying multiple possible names."""
    possible_names = COLUMN_MAPPINGS.get(field_name, [field_name])
    headers_lower = [h.lower().strip() for h in headers]

    for name in possible_names:
        if name.lower() in headers_lower:
            return headers_lower.index(name.lower())
    return None


def _get_value(row: List[str], index: Optional[int], default: str = "") -> str:
    """Safely get value from row by index."""
    if index is None or index >= len(row):
        return default
    return row[index].strip()


def _parse_decimal(value: str) -> Decimal:
    """Parse decimal value, handling various formats."""
    if not value:
        return Decimal("0")

    # Remove currency symbols and whitespace
    cleaned = value.replace("$", "").replace("€", "").replace("£", "").strip()
    # Handle negative in parentheses: (123.45) -> -123.45
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = "-" + cleaned[1:-1]
    # Remove thousands separators
    cleaned = cleaned.replace(",", "")

    try:
        return Decimal(cleaned)
    except InvalidOperation:
        raise ValueError(f"Cannot parse decimal: {value}")


def _parse_int(value: str) -> int:
    """Parse integer value."""
    if not value:
        return 0
    try:
        # Handle decimal units (e.g., "1.0" -> 1)
        return int(float(value.replace(",", "")))
    except ValueError:
        raise ValueError(f"Cannot parse integer: {value}")


class TuneCoreParser:
    """Parser for TuneCore CSV files."""

    def __init__(self):
        self._column_indices: Dict[str, Optional[int]] = {}

    def _detect_columns(self, headers: List[str]) -> None:
        """Detect column indices from headers."""
        for field_name in COLUMN_MAPPINGS:
            self._column_indices[field_name] = _find_column_index(headers, field_name)

        # Validate required columns
        required = ["artist", "total_earned"]
        missing = [f for f in required if self._column_indices.get(f) is None]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

    def _parse_row(self, row: List[str], row_number: int) -> TuneCoreRow:
        """Parse a single CSV row into a TuneCoreRow."""
        artist = _get_value(row, self._column_indices.get("artist"))
        if not artist:
            raise ValueError("Artist name is required")

        total_earned_str = _get_value(row, self._column_indices.get("total_earned"), "0")
        total_earned = _parse_decimal(total_earned_str)

        units_str = _get_value(row, self._column_indices.get("units_sold"), "0")
        units_sold = _parse_int(units_str)

        return TuneCoreRow(
            row_number=row_number,
            artist=artist,
            release_title=_get_value(row, self._column_indices.get("release_title")),
            song_title=_get_value(row, self._column_indices.get("song_title")),
            isrc=_get_value(row, self._column_indices.get("isrc")) or None,
            upc=_get_value(row, self._column_indices.get("upc")) or None,
            country_of_sale=_get_value(row, self._column_indices.get("country_of_sale")) or None,
            sales_type=_get_value(row, self._column_indices.get("sales_type")) or None,
            units_sold=units_sold,
            total_earned=total_earned,
            currency=_get_value(row, self._column_indices.get("currency"), "USD"),
            sales_period=_get_value(row, self._column_indices.get("sales_period")),
            store_name=_get_value(row, self._column_indices.get("store_name")) or None,
        )

    def parse(self, content: Union[str, bytes]) -> TuneCoreParseResult:
        """
        Parse TuneCore CSV content.

        Args:
            content: CSV file content as string or bytes

        Returns:
            TuneCoreParseResult with parsed rows and errors
        """
        if isinstance(content, bytes):
            # Try UTF-8 first, then latin-1 as fallback
            try:
                content = content.decode("utf-8-sig")  # Handle BOM
            except UnicodeDecodeError:
                content = content.decode("latin-1")

        result = TuneCoreParseResult()

        # Use csv.reader for robust parsing
        reader = csv.reader(io.StringIO(content))

        try:
            headers = next(reader)
        except StopIteration:
            result.errors.append(ParseError(
                row_number=0,
                error="Empty CSV file",
            ))
            return result

        try:
            self._detect_columns(headers)
        except ValueError as e:
            result.errors.append(ParseError(
                row_number=0,
                error=str(e),
            ))
            return result

        for row_number, row in enumerate(reader, start=2):  # Start at 2 (1-indexed, after header)
            result.total_rows += 1

            # Skip empty rows
            if not row or all(cell.strip() == "" for cell in row):
                continue

            try:
                parsed_row = self._parse_row(row, row_number)
                result.rows.append(parsed_row)
            except (ValueError, IndexError) as e:
                result.errors.append(ParseError(
                    row_number=row_number,
                    error=str(e),
                    raw_data=dict(zip(headers[:len(row)], row)) if row else None,
                ))

        return result

    def parse_iter(self, content: Union[str, bytes]) -> Iterator[Union[TuneCoreRow, ParseError]]:
        """
        Parse TuneCore CSV content as an iterator (memory efficient for large files).

        Yields:
            TuneCoreRow or ParseError for each row
        """
        if isinstance(content, bytes):
            try:
                content = content.decode("utf-8-sig")
            except UnicodeDecodeError:
                content = content.decode("latin-1")

        reader = csv.reader(io.StringIO(content))

        try:
            headers = next(reader)
        except StopIteration:
            yield ParseError(row_number=0, error="Empty CSV file")
            return

        try:
            self._detect_columns(headers)
        except ValueError as e:
            yield ParseError(row_number=0, error=str(e))
            return

        for row_number, row in enumerate(reader, start=2):
            if not row or all(cell.strip() == "" for cell in row):
                continue

            try:
                yield self._parse_row(row, row_number)
            except (ValueError, IndexError) as e:
                yield ParseError(
                    row_number=row_number,
                    error=str(e),
                    raw_data=dict(zip(headers[:len(row)], row)) if row else None,
                )
