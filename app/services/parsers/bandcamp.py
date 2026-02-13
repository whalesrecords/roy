"""
Bandcamp CSV Parser

Parses Bandcamp sales reports. Handles various Bandcamp export formats.
Returns raw parsed data for normalization.

Bandcamp CSV columns typically include:
- date / date_utc / paid / paid_to_you_utc
- item type / item_type (track, album, package, bundle)
- item name / item_name (track or album title)
- artist / band
- currency
- item total / item_total / net amount / net_amount
- quantity
- upc (sometimes)
- country / country code
- sku (for physical items)
- bandcamp transaction id
"""

import csv
import io
import logging
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Dict, Iterator, List, Optional, Union
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class BandcampRow:
    """Raw parsed row from Bandcamp CSV."""
    row_number: int
    artist: str
    item_name: str  # Track or album title
    item_type: str  # track, album, package, etc.
    container_name: Optional[str]  # Album name for tracks
    quantity: int
    net_amount: Decimal
    currency: str
    region: Optional[str]
    upc: Optional[str]
    isrc: Optional[str]
    date_from: Optional[str]
    date_to: Optional[str]
    sku: Optional[str] = None
    cat_no: Optional[str] = None
    package: Optional[str] = None  # Physical format: "Compact Disc (CD)", "Vinyl LP", etc.
    item_url: Optional[str] = None  # Bandcamp page URL for artwork lookup


@dataclass
class ParseError:
    """Represents a parsing error for a specific row."""
    row_number: int
    error: str
    raw_data: Optional[Dict] = None


@dataclass
class BandcampParseResult:
    """Result of parsing a Bandcamp CSV."""
    rows: List[BandcampRow] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)
    total_rows: int = 0


# Column name mappings - tolerant to variations
COLUMN_MAPPINGS = {
    "artist": ["artist name", "artist", "band", "band name"],
    "item_name": ["item name", "item_name", "title", "track", "album"],
    "item_type": ["item type", "item_type", "type", "product type"],
    "container_name": ["container name", "container_name", "album", "release"],
    "quantity": ["quantity", "qty", "units", "# units"],
    "net_amount": [
        "net amount", "net_amount",  # Prefer net amount (amount after Bandcamp fees)
        "net revenue", "net_revenue",  # Then net revenue
        "your share", "amount you received",  # Then your share
        "sub total", "sub_total", "subtotal",  # Then sub total
        "item total", "item_total",  # Then item total
        "amount", "net", "item price"
    ],
    "gross_amount": ["gross revenue", "gross_revenue", "gross amount", "gross"],
    "bandcamp_fee": [
        "transaction fee", "bandcamp fee", "fee",
        "revenue share", "commission", "platform fee",
    ],
    "currency": ["currency", "currency code", "cur"],
    "region": ["region", "country", "country code", "buyer country", "location"],
    "upc": ["upc", "upc code", "upc/ean", "barcode"],
    "isrc": ["isrc", "isrc code"],
    "date_from": [
        "transaction date from", "date from", "date_from",
        "date", "date_utc", "paid", "sale date"
    ],
    "date_to": ["transaction date to", "date to", "date_to"],
    "sku": ["sku", "sku code", "product code", "variant"],
    "cat_no": ["cat no.", "cat no", "catalog number", "catalogue number", "cat_no"],
    "package": ["package", "package type", "format", "physical format"],
    "item_url": ["item url", "item_url", "url", "bandcamp url", "page url"],
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
    cleaned = value.replace("$", "").replace("€", "").replace("£", "").replace("¥", "").strip()
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
        return 1  # Default to 1 for Bandcamp
    try:
        # Handle decimal units (e.g., "1.0" -> 1)
        return int(float(value.replace(",", "")))
    except ValueError:
        raise ValueError(f"Cannot parse integer: {value}")


def _normalize_item_type(item_type: str) -> str:
    """Normalize item type to standard values."""
    if not item_type:
        return "other"

    item_type_lower = item_type.lower().strip()

    # Track types
    if item_type_lower in ["track", "single", "song"]:
        return "track"

    # Album types
    if item_type_lower in ["album", "lp", "ep", "full-length"]:
        return "album"

    # Physical/package types
    if item_type_lower in ["package", "physical", "merch", "merchandise", "bundle", "vinyl", "cd", "cassette"]:
        return "package"

    return "other"


class BandcampParser:
    """Parser for Bandcamp CSV files."""

    def __init__(self):
        self._column_indices: Dict[str, Optional[int]] = {}

    def _detect_columns(self, headers: List[str]) -> None:
        """Detect column indices from headers."""
        for field_name in COLUMN_MAPPINGS:
            self._column_indices[field_name] = _find_column_index(headers, field_name)

        # Track which column name was actually matched for net_amount
        # so we know if we need to subtract Bandcamp's fee
        self._net_amount_is_gross = False
        if self._column_indices.get("net_amount") is not None:
            headers_lower = [h.lower().strip() for h in headers]
            matched_header = headers_lower[self._column_indices["net_amount"]]
            # These columns represent customer-paid amounts, NOT the net payout
            gross_column_names = {
                "sub total", "sub_total", "subtotal",
                "item total", "item_total",
                "amount", "item price",
            }
            if matched_header in gross_column_names:
                self._net_amount_is_gross = True
                has_fee = self._column_indices.get("bandcamp_fee") is not None
                logger.warning(
                    f"Bandcamp CSV: no 'net amount' column found, using '{matched_header}' instead. "
                    f"Fee column {'found' if has_fee else 'NOT found'} — "
                    f"{'will subtract fee' if has_fee else 'amounts may be gross, not net'}."
                )
            else:
                logger.info(f"Bandcamp CSV: using '{matched_header}' column for net amount")

        # Validate required columns - be lenient
        required = ["net_amount"]  # Only amount is truly required
        missing = [f for f in required if self._column_indices.get(f) is None]
        if missing:
            raise ValueError(f"Missing required columns: {missing}. Available columns: {headers}")

    def _parse_row(self, row: List[str], row_number: int) -> BandcampRow:
        """Parse a single CSV row into a BandcampRow."""

        # Get artist - try to find it
        artist = _get_value(row, self._column_indices.get("artist"))
        if not artist:
            # Try to extract from item_name if it contains " - "
            item_name_raw = _get_value(row, self._column_indices.get("item_name"))
            if " - " in item_name_raw:
                parts = item_name_raw.split(" - ", 1)
                artist = parts[0].strip()
            else:
                artist = "Unknown Artist"

        net_amount_str = _get_value(row, self._column_indices.get("net_amount"), "0")
        net_amount = _parse_decimal(net_amount_str)

        # If the matched column is actually a gross amount (sub total, item total, etc.),
        # subtract the Bandcamp fee to get the real net amount
        if self._net_amount_is_gross and net_amount > 0:
            fee_str = _get_value(row, self._column_indices.get("bandcamp_fee"), "")
            if fee_str:
                fee = _parse_decimal(fee_str)
                net_amount = net_amount - abs(fee)  # fee may be positive or negative
            # No fee column: cannot determine net, keep as-is (will be flagged)

        quantity_str = _get_value(row, self._column_indices.get("quantity"), "1")
        quantity = _parse_int(quantity_str)

        item_type_raw = _get_value(row, self._column_indices.get("item_type"), "other")
        item_type = _normalize_item_type(item_type_raw)

        item_name = _get_value(row, self._column_indices.get("item_name"))
        container_name = _get_value(row, self._column_indices.get("container_name")) or None

        return BandcampRow(
            row_number=row_number,
            artist=artist,
            item_name=item_name,
            item_type=item_type,
            container_name=container_name,
            quantity=quantity,
            net_amount=net_amount,
            currency=_get_value(row, self._column_indices.get("currency"), "EUR"),
            region=_get_value(row, self._column_indices.get("region")) or None,
            upc=_get_value(row, self._column_indices.get("upc")) or None,
            isrc=_get_value(row, self._column_indices.get("isrc")) or None,
            date_from=_get_value(row, self._column_indices.get("date_from")) or None,
            date_to=_get_value(row, self._column_indices.get("date_to")) or None,
            sku=_get_value(row, self._column_indices.get("sku")) or None,
            cat_no=_get_value(row, self._column_indices.get("cat_no")) or None,
            package=_get_value(row, self._column_indices.get("package")) or None,
            item_url=_get_value(row, self._column_indices.get("item_url")) or None,
        )

    def parse(self, content: Union[str, bytes]) -> BandcampParseResult:
        """
        Parse Bandcamp CSV content.

        Args:
            content: CSV file content as string or bytes

        Returns:
            BandcampParseResult with parsed rows and errors
        """
        if isinstance(content, bytes):
            # Try UTF-16 first (Bandcamp often exports in UTF-16), then UTF-8, then latin-1
            try:
                content = content.decode("utf-16")
            except (UnicodeDecodeError, UnicodeError):
                try:
                    content = content.decode("utf-8-sig")  # Handle BOM
                except UnicodeDecodeError:
                    content = content.decode("latin-1")

        result = BandcampParseResult()

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

    def parse_iter(self, content: Union[str, bytes]) -> Iterator[Union[BandcampRow, ParseError]]:
        """
        Parse Bandcamp CSV content as an iterator (memory efficient for large files).

        Yields:
            BandcampRow or ParseError for each row
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
