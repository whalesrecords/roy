"""
Believe CSV Parser

Parses Believe music sales reports. Handles French-language column headers.
Returns raw parsed data for normalization.

Believe CSV format:
- Delimiter: semicolon (;)
- Decimal separator: comma (,)
- Encoding: UTF-8 with BOM
- French column headers
"""

import csv
import io
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Dict, Iterator, List, Optional, Union


@dataclass
class BelieveRow:
    """Raw parsed row from Believe CSV."""
    row_number: int
    artist: str
    release_title: str
    track_title: str
    isrc: Optional[str]
    upc: Optional[str]
    country: Optional[str]
    sale_type: Optional[str]
    quantity: int
    net_revenue: Decimal
    gross_revenue: Decimal
    currency: str
    reporting_month: str
    sales_month: str
    platform: Optional[str]  # Spotify, YouTube UGC, Amazon Premium, etc.
    label_name: Optional[str]
    catalog_reference: Optional[str]
    release_type: Optional[str]
    revenue_rate: Optional[Decimal]  # Taux de revenu (0.75, 0.8, etc.)


@dataclass
class ParseError:
    """Represents a parsing error for a specific row."""
    row_number: int
    error: str
    raw_data: Optional[Dict] = None


@dataclass
class BelieveParseResult:
    """Result of parsing a Believe CSV."""
    rows: List[BelieveRow] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)
    total_rows: int = 0


# Column name mappings - French headers to field names
COLUMN_MAPPINGS = {
    "artist": [
        "nom de l'artiste", "nom de l artiste", "artist", "artiste",
        "artist name", "nom artiste"
    ],
    "release_title": [
        "titre de la sortie", "titre sortie", "release title",
        "album", "release", "sortie"
    ],
    "track_title": [
        "titre de la piste", "titre piste", "track title",
        "track", "piste", "titre"
    ],
    "isrc": ["isrc", "code isrc"],
    "upc": ["upc", "code upc", "ean", "upc/ean"],
    "country": [
        "pays / région", "pays / region", "pays", "region", "région",
        "country", "territory", "pays / r\u00e9gion"
    ],
    "sale_type": [
        "type de vente", "type vente", "sale type", "type",
        "sales type"
    ],
    "quantity": [
        "quantite", "quantité", "quantity", "qty", "units",
        "# units", "nb"
    ],
    "net_revenue": [
        "revenu net", "net revenue", "net", "revenu_net",
        "montant net"
    ],
    "gross_revenue": [
        "revenu brut", "gross revenue", "gross", "revenu_brut",
        "montant brut"
    ],
    "currency": [
        "devise de paiement du client", "devise", "currency",
        "currency code", "devise paiement"
    ],
    "reporting_month": [
        "mois de reporting", "reporting month", "mois reporting",
        "period", "période"
    ],
    "sales_month": [
        "mois de vente", "sales month", "mois vente",
        "sale date", "date vente"
    ],
    "platform": [
        "plateforme", "platform", "store", "dsp", "service",
        "store name"
    ],
    "label_name": [
        "nom du label", "label", "label name", "nom label"
    ],
    "catalog_reference": [
        "reference catalogue sortie", "référence catalogue",
        "catalog reference", "cat ref", "catalogue"
    ],
    "release_type": [
        "type de sortie", "release type", "type sortie"
    ],
    "revenue_rate": [
        "taux de revenu client", "taux revenu", "revenue rate",
        "rate", "taux"
    ],
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

    Examples:
        "0,005521855338613" -> Decimal("0.005521855338613")
        "-0,000211" -> Decimal("-0.000211")
    """
    if not value:
        return Decimal("0")

    # Remove currency symbols and whitespace
    cleaned = value.replace("€", "").replace("$", "").replace("£", "").strip()

    # Handle negative in parentheses: (123,45) -> -123.45
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = "-" + cleaned[1:-1]

    # Replace French decimal separator (comma) with period
    # But only if there's no period (to handle already-formatted numbers)
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


class BelieveParser:
    """Parser for Believe CSV files."""

    def __init__(self):
        self._column_indices: Dict[str, Optional[int]] = {}

    def _detect_columns(self, headers: List[str]) -> None:
        """Detect column indices from headers."""
        for field_name in COLUMN_MAPPINGS:
            self._column_indices[field_name] = _find_column_index(headers, field_name)

        # Validate required columns
        required = ["artist", "net_revenue"]
        missing = [f for f in required if self._column_indices.get(f) is None]
        if missing:
            raise ValueError(f"Missing required columns: {missing}. Available columns: {headers}")

    def _parse_row(self, row: List[str], row_number: int) -> BelieveRow:
        """Parse a single CSV row into a BelieveRow."""
        artist = _get_value(row, self._column_indices.get("artist"))
        if not artist:
            raise ValueError("Artist name is required")

        net_revenue_str = _get_value(row, self._column_indices.get("net_revenue"), "0")
        net_revenue = _parse_decimal_french(net_revenue_str)

        gross_revenue_str = _get_value(row, self._column_indices.get("gross_revenue"), "0")
        gross_revenue = _parse_decimal_french(gross_revenue_str) if gross_revenue_str else net_revenue

        quantity_str = _get_value(row, self._column_indices.get("quantity"), "0")
        quantity = _parse_int(quantity_str)

        revenue_rate_str = _get_value(row, self._column_indices.get("revenue_rate"))
        revenue_rate = _parse_decimal_french(revenue_rate_str) if revenue_rate_str else None

        return BelieveRow(
            row_number=row_number,
            artist=artist,
            release_title=_get_value(row, self._column_indices.get("release_title")),
            track_title=_get_value(row, self._column_indices.get("track_title")),
            isrc=_get_value(row, self._column_indices.get("isrc")) or None,
            upc=_get_value(row, self._column_indices.get("upc")) or None,
            country=_get_value(row, self._column_indices.get("country")) or None,
            sale_type=_get_value(row, self._column_indices.get("sale_type")) or None,
            quantity=quantity,
            net_revenue=net_revenue,
            gross_revenue=gross_revenue,
            currency=_get_value(row, self._column_indices.get("currency"), "EUR"),
            reporting_month=_get_value(row, self._column_indices.get("reporting_month")),
            sales_month=_get_value(row, self._column_indices.get("sales_month")),
            platform=_get_value(row, self._column_indices.get("platform")) or None,
            label_name=_get_value(row, self._column_indices.get("label_name")) or None,
            catalog_reference=_get_value(row, self._column_indices.get("catalog_reference")) or None,
            release_type=_get_value(row, self._column_indices.get("release_type")) or None,
            revenue_rate=revenue_rate,
        )

    def parse(self, content: Union[str, bytes]) -> BelieveParseResult:
        """
        Parse Believe CSV content.

        Args:
            content: CSV file content as string or bytes

        Returns:
            BelieveParseResult with parsed rows and errors
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

        result = BelieveParseResult()

        # Believe uses semicolon as delimiter
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
                result.rows.append(parsed_row)
            except (ValueError, IndexError) as e:
                result.errors.append(ParseError(
                    row_number=row_number,
                    error=str(e),
                    raw_data=dict(zip(headers[:len(row)], row)) if row else None,
                ))

        return result

    def parse_iter(self, content: Union[str, bytes]) -> Iterator[Union[BelieveRow, ParseError]]:
        """
        Parse Believe CSV content as an iterator (memory efficient for large files).

        Yields:
            BelieveRow or ParseError for each row
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
                yield self._parse_row(row, row_number)
            except (ValueError, IndexError) as e:
                yield ParseError(
                    row_number=row_number,
                    error=str(e),
                    raw_data=dict(zip(headers[:len(row)], row)) if row else None,
                )
