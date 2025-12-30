"""
Believe FR CSV Parser

Parses Believe FR music sales reports (Statement Details format).
Returns raw parsed data for normalization.

Believe FR CSV format:
- Delimiter: semicolon (;)
- Decimal separator: comma (,)
- Date format: DD/MM/YYYY
- English column headers
"""

import csv
import io
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Dict, Iterator, List, Optional, Union


@dataclass
class BelieveFRRow:
    """Raw parsed row from Believe FR CSV."""
    row_number: int
    exploitation_type: str  # Phono, etc.
    reporting_date: str  # DD/MM/YYYY
    operation_date: str  # DD/MM/YYYY
    shop: Optional[str]  # GVL (DE), Audiogest (PT), Spotify, etc.
    country: Optional[str]  # DE, PT, FR, etc.
    upc: Optional[str]
    product_artist: str
    product_title: str
    isrc: Optional[str]
    track_artist: str
    track_title: str
    track_version: Optional[str]
    net_sales: int
    currency: str
    unit_price: Decimal
    income: Decimal
    net_income: Decimal
    share: Optional[Decimal]  # 100,00% -> 1.0
    rate: Optional[Decimal]  # 60,00% -> 0.6
    amount: Decimal  # Final amount after rate


@dataclass
class ParseError:
    """Represents a parsing error for a specific row."""
    row_number: int
    error: str
    raw_data: Optional[Dict] = None


@dataclass
class BelieveFRParseResult:
    """Result of parsing a Believe FR CSV."""
    rows: List[BelieveFRRow] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)
    total_rows: int = 0


# Column name mappings
COLUMN_MAPPINGS = {
    "type": ["type"],
    "exploitation_type": ["exploitation type"],
    "reporting_date": ["reporting date"],
    "operation_date": ["operation date"],
    "shop": ["shop"],
    "country": ["country"],
    "upc": ["upc", "delivered upc"],
    "product_artist": ["product artist"],
    "product_title": ["product title / description", "product title"],
    "isrc": ["isrc"],
    "track_artist": ["track artist"],
    "track_title": ["track title"],
    "track_version": ["track version"],
    "sales": ["sales"],
    "returns": ["returns"],
    "net_sales": ["net sales"],
    "currency": ["currency"],
    "unit_price": ["unit price"],
    "income": ["income"],
    "net_income": ["net income"],
    "share": ["share"],
    "rate": ["rate"],
    "amount": ["amount"],
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


def _parse_decimal_french(value: str) -> Decimal:
    """
    Parse decimal value with French format (comma as decimal separator).
    """
    if not value:
        return Decimal("0")

    # Remove currency symbols and whitespace
    cleaned = value.replace("€", "").replace("$", "").replace("£", "").strip()

    # Handle percentage format (100,00% -> 1.0)
    if cleaned.endswith("%"):
        cleaned = cleaned[:-1].strip()
        # Replace comma with period for decimal
        if "," in cleaned and "." not in cleaned:
            cleaned = cleaned.replace(",", ".")
        try:
            return Decimal(cleaned) / Decimal("100")
        except InvalidOperation:
            return Decimal("0")

    # Handle negative in parentheses: (123,45) -> -123.45
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = "-" + cleaned[1:-1]

    # Replace French decimal separator (comma) with period
    if "," in cleaned and "." not in cleaned:
        cleaned = cleaned.replace(",", ".")
    elif "," in cleaned and "." in cleaned:
        # Format: 1.234,56 (thousands separator is period, decimal is comma)
        cleaned = cleaned.replace(".", "").replace(",", ".")

    try:
        return Decimal(cleaned)
    except InvalidOperation:
        raise ValueError(f"Cannot parse decimal: {value}")


def _parse_int(value: str) -> int:
    """Parse integer value."""
    if not value:
        return 0
    try:
        # Handle decimal units (e.g., "1,0" -> 1)
        cleaned = value.replace(",", ".").replace(" ", "")
        return int(float(cleaned))
    except ValueError:
        raise ValueError(f"Cannot parse integer: {value}")


class BelieveFRParser:
    """Parser for Believe FR CSV files."""

    def __init__(self):
        self._column_indices: Dict[str, Optional[int]] = {}

    def _detect_columns(self, headers: List[str]) -> None:
        """Detect column indices from headers."""
        for field_name in COLUMN_MAPPINGS:
            self._column_indices[field_name] = _find_column_index(headers, field_name)

        # Validate required columns
        required = ["track_artist", "amount"]
        missing = [f for f in required if self._column_indices.get(f) is None]
        if missing:
            raise ValueError(f"Missing required columns: {missing}. Available columns: {headers}")

    def _parse_row(self, row: List[str], row_number: int) -> Optional[BelieveFRRow]:
        """Parse a single CSV row into a BelieveFRRow. Returns None for payment/summary rows."""
        # Skip payment/summary rows
        row_type = _get_value(row, self._column_indices.get("type"))
        if row_type.lower() == "payment":
            return None

        track_artist = _get_value(row, self._column_indices.get("track_artist"))
        if not track_artist:
            # Try product_artist as fallback
            track_artist = _get_value(row, self._column_indices.get("product_artist"))
        if not track_artist:
            raise ValueError("Artist name is required")

        amount_str = _get_value(row, self._column_indices.get("amount"), "0")
        amount = _parse_decimal_french(amount_str)

        income_str = _get_value(row, self._column_indices.get("income"), "0")
        income = _parse_decimal_french(income_str)

        net_income_str = _get_value(row, self._column_indices.get("net_income"), "0")
        net_income = _parse_decimal_french(net_income_str)

        unit_price_str = _get_value(row, self._column_indices.get("unit_price"), "0")
        unit_price = _parse_decimal_french(unit_price_str)

        net_sales_str = _get_value(row, self._column_indices.get("net_sales"), "0")
        net_sales = _parse_int(net_sales_str)

        share_str = _get_value(row, self._column_indices.get("share"))
        share = _parse_decimal_french(share_str) if share_str else None

        rate_str = _get_value(row, self._column_indices.get("rate"))
        rate = _parse_decimal_french(rate_str) if rate_str else None

        return BelieveFRRow(
            row_number=row_number,
            exploitation_type=_get_value(row, self._column_indices.get("exploitation_type")),
            reporting_date=_get_value(row, self._column_indices.get("reporting_date")),
            operation_date=_get_value(row, self._column_indices.get("operation_date")),
            shop=_get_value(row, self._column_indices.get("shop")) or None,
            country=_get_value(row, self._column_indices.get("country")) or None,
            upc=_get_value(row, self._column_indices.get("upc")) or None,
            product_artist=_get_value(row, self._column_indices.get("product_artist")),
            product_title=_get_value(row, self._column_indices.get("product_title")),
            isrc=_get_value(row, self._column_indices.get("isrc")) or None,
            track_artist=track_artist,
            track_title=_get_value(row, self._column_indices.get("track_title")),
            track_version=_get_value(row, self._column_indices.get("track_version")) or None,
            net_sales=net_sales,
            currency=_get_value(row, self._column_indices.get("currency"), "EUR"),
            unit_price=unit_price,
            income=income,
            net_income=net_income,
            share=share,
            rate=rate,
            amount=amount,
        )

    def parse(self, content: Union[str, bytes]) -> BelieveFRParseResult:
        """
        Parse Believe FR CSV content.

        Args:
            content: CSV file content as string or bytes

        Returns:
            BelieveFRParseResult with parsed rows and errors
        """
        if isinstance(content, bytes):
            # Try UTF-8 with BOM first, then latin-1 as fallback
            try:
                content = content.decode("utf-8-sig")
            except UnicodeDecodeError:
                try:
                    content = content.decode("utf-8")
                except UnicodeDecodeError:
                    content = content.decode("latin-1")

        result = BelieveFRParseResult()

        # Believe FR uses semicolon as delimiter
        reader = csv.reader(io.StringIO(content), delimiter=";")

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
                if parsed_row is not None:  # Skip payment rows
                    result.rows.append(parsed_row)
            except (ValueError, IndexError) as e:
                result.errors.append(ParseError(
                    row_number=row_number,
                    error=str(e),
                    raw_data=dict(zip(headers[:len(row)], row)) if row else None,
                ))

        return result

    def parse_iter(self, content: Union[str, bytes]) -> Iterator[Union[BelieveFRRow, ParseError]]:
        """
        Parse Believe FR CSV content as an iterator (memory efficient for large files).

        Yields:
            BelieveFRRow or ParseError for each row
        """
        if isinstance(content, bytes):
            try:
                content = content.decode("utf-8-sig")
            except UnicodeDecodeError:
                try:
                    content = content.decode("utf-8")
                except UnicodeDecodeError:
                    content = content.decode("latin-1")

        reader = csv.reader(io.StringIO(content), delimiter=";")

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
                parsed_row = self._parse_row(row, row_number)
                if parsed_row is not None:
                    yield parsed_row
            except (ValueError, IndexError) as e:
                yield ParseError(
                    row_number=row_number,
                    error=str(e),
                    raw_data=dict(zip(headers[:len(row)], row)) if row else None,
                )
