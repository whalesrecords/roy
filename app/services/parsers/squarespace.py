"""
Squarespace CSV Parser

Supports two Squarespace export formats:

1. Orders CSV (Squarespace order exports):
   Columns: Order ID, Email, Paid at, Currency, Subtotal, Shipping, Taxes, Total,
            Lineitem name, Lineitem price, Lineitem quantity, Lineitem sku, Lineitem variant,
            Payment Method, Payment Reference

2. Products CSV (Squarespace catalogue export):
   Columns: Product ID [Non Editable], Variant ID [Non Editable], Product Type [Non Editable],
            Title, Description, SKU, GTIN, Option Name 1, Option Value 1, ...,
            Price, Sale Price, Stock, Categories, Tags, ...

The parser auto-detects the format from the CSV headers.
"""

import csv
import io
import re
from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Dict, Iterator, List, Optional, Union


@dataclass
class SquarespaceRow:
    """Raw parsed row from Squarespace CSV."""
    row_number: int
    order_id: str
    artist: str
    item_name: str  # Album or track title
    item_type: str  # album, track, package
    quantity: int
    net_amount: Decimal  # Lineitem price (excluding shipping & taxes)
    currency: str
    date_from: Optional[str]
    sku: Optional[str] = None
    variant: Optional[str] = None  # Color, edition, etc.
    payment_method: Optional[str] = None


@dataclass
class ParseError:
    """Represents a parsing error for a specific row."""
    row_number: int
    error: str
    raw_data: Optional[Dict] = None


@dataclass
class SquarespaceProductRow:
    """Raw parsed row from Squarespace Products CSV export."""
    row_number: int
    item_name: str          # Parsed album/product name (e.g., "Eclipses")
    artist: str             # Parsed artist name (e.g., "Lissom")
    item_type: str          # "package" for PHYSICAL products
    sku: Optional[str]
    variant: Optional[str]  # Option Value 1 (colour, edition, etc.)
    stock_quantity: int     # Current stock from the Stock column
    package: Optional[str]  # Full original title — used by _guess_product_format
    upc: Optional[str] = None  # GTIN column


@dataclass
class SquarespaceParseResult:
    """Result of parsing a Squarespace CSV (orders or products format)."""
    rows: List[Union[SquarespaceRow, "SquarespaceProductRow"]] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)
    total_rows: int = 0


def _parse_decimal(value: str) -> Decimal:
    """Parse decimal value, handling various formats."""
    if not value or value.strip() == "":
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
    if not value or value.strip() == "":
        return 1
    try:
        return int(float(value.replace(",", "")))
    except ValueError:
        raise ValueError(f"Cannot parse integer: {value}")


def _guess_artist_from_sku(sku: str) -> Optional[str]:
    """Guess artist from SKU code."""
    if not sku:
        return None

    # SKU patterns: WR22JM016 (JM = Julien Marchal), WR22LI014 (LI = Lissom)
    sku_upper = sku.upper()
    if 'JM' in sku_upper:
        return "Julien Marchal"
    elif 'LI' in sku_upper:
        return "Lissom"

    return None


def _guess_artist_from_album(album_name: str) -> Optional[str]:
    """Guess artist from album name patterns."""
    if not album_name:
        return None

    album_lower = album_name.lower()

    # INSIGHT series → Julien Marchal
    if 'insight' in album_lower:
        return "Julien Marchal"

    # Eclipses → Lissom
    if 'eclipses' in album_lower:
        return "Lissom"

    # Lissom self-titled
    if album_lower.strip() == 'lissom':
        return "Lissom"

    return None


def _parse_artist_and_album(lineitem_name: str, sku: str = "") -> tuple[str, str, str]:
    """
    Parse artist and album from lineitem name.

    Formats:
    - "Artist - Album - Format" -> (Artist, Album, package)
    - "Album by Artist - Format" -> (Artist, Album, package)
    - "Artist - Album (Scores)" -> (Artist, Album, album)
    - "INSIGHT II - Format" -> (?, INSIGHT II, package) - use SKU to determine artist

    Returns: (artist, album, item_type)
    """
    if not lineitem_name:
        return ("Unknown Artist", "Unknown Album", "other")

    # Detect item type from format indicators
    item_type = "album"  # default
    if any(fmt in lineitem_name.lower() for fmt in ["vinyl", "cd", "cassette", "tape"]):
        item_type = "package"
    elif "score" in lineitem_name.lower() or "pdf" in lineitem_name.lower():
        item_type = "album"  # Digital scores

    # Try "Album by Artist - Format" pattern
    by_match = re.match(r'^(.+?)\s+by\s+(.+?)\s*-\s*(.+)$', lineitem_name, re.IGNORECASE)
    if by_match:
        album = by_match.group(1).strip()
        artist = by_match.group(2).strip()
        return (artist, album, item_type)

    # Try "Artist - Album - Format" pattern (3+ parts)
    dash_parts = lineitem_name.split(" - ")
    if len(dash_parts) >= 3:
        first_part = dash_parts[0].strip()
        second_part = dash_parts[1].strip()

        # Check if first part looks like album without artist
        # (e.g., "INSIGHT II - Limited Edition 12" Vinyl - ...")
        if any(fmt in second_part.lower() for fmt in ["limited", "edition", "vinyl", "cd"]):
            # First part is album, not artist
            artist = _guess_artist_from_sku(sku)
            if not artist:
                artist = _guess_artist_from_album(first_part)
            if artist:
                return (artist, first_part, item_type)
            return ("Unknown Artist", first_part, item_type)

        # Normal case: Artist - Album - Format
        artist = first_part
        album = second_part
        # Clean up album name: remove parentheticals like (Remastered)
        album = re.sub(r'\s*\([^)]*\)$', '', album)
        return (artist, album, item_type)
    elif len(dash_parts) == 2:
        # "Artist - Album" or "Album - Format"
        first_part = dash_parts[0].strip()
        second_part = dash_parts[1].strip()

        # If second part looks like a format/edition, first is album (no artist)
        if any(fmt in second_part.lower() for fmt in ["vinyl", "cd", "12\"", "limited", "edition", "piano scores", "all piano"]):
            # Try to guess artist from SKU first
            artist = _guess_artist_from_sku(sku)
            if not artist:
                # Try to guess from album name
                artist = _guess_artist_from_album(first_part)
            if artist:
                return (artist, first_part, item_type)
            return ("Unknown Artist", first_part, item_type)
        else:
            # Assume "Artist - Album"
            return (first_part, second_part, item_type)

    # Fallback: use full name as album
    return ("Unknown Artist", lineitem_name, item_type)


class SquarespaceParser:
    """Parser for Squarespace order CSV files."""

    def _parse_orders(self, content: str) -> Dict[str, Dict]:
        """
        Parse Squarespace CSV into grouped orders.

        Returns: Dict[order_id, order_data]
        """
        reader = csv.DictReader(io.StringIO(content))
        orders = defaultdict(lambda: {
            'order_id': '',
            'email': '',
            'paid_at': '',
            'currency': 'EUR',
            'total': '0',
            'payment_method': '',
            'items': []
        })

        current_order_id = None

        for row in reader:
            order_id = row.get('Order ID', '').strip()

            # If we have an Order ID, update current order
            if order_id:
                current_order_id = order_id
                orders[order_id].update({
                    'order_id': order_id,
                    'email': row.get('Email', ''),
                    'paid_at': row.get('Paid at', ''),
                    'currency': row.get('Currency', 'EUR'),
                    'total': row.get('Total', '0'),
                    'payment_method': row.get('Payment Method', ''),
                })

            # Add lineitem if present (for both new order line and continuation lines)
            lineitem_name = row.get('Lineitem name', '').strip()
            if lineitem_name and current_order_id:
                orders[current_order_id]['items'].append({
                    'name': lineitem_name,
                    'price': row.get('Lineitem price', '0'),
                    'quantity': row.get('Lineitem quantity', '1'),
                    'sku': row.get('Lineitem sku', ''),
                    'variant': row.get('Lineitem variant', ''),
                })

        return dict(orders)

    def _parse_row(self, order_data: Dict, item: Dict, row_number: int) -> SquarespaceRow:
        """Parse a single order item into a SquarespaceRow."""

        # Parse artist and album from lineitem name (using SKU as hint)
        artist, album, item_type = _parse_artist_and_album(item['name'], item.get('sku', ''))

        # Parse amounts
        net_amount = _parse_decimal(item['price'])
        quantity = _parse_int(item['quantity'])

        return SquarespaceRow(
            row_number=row_number,
            order_id=order_data['order_id'],
            artist=artist,
            item_name=album,
            item_type=item_type,
            quantity=quantity,
            net_amount=net_amount,
            currency=order_data['currency'],
            date_from=order_data['paid_at'] or None,
            sku=item['sku'] or None,
            variant=item['variant'] or None,
            payment_method=order_data['payment_method'] or None,
        )

    # ------------------------------------------------------------------
    # Products-format parsing (Squarespace catalogue / inventory export)
    # ------------------------------------------------------------------

    def _parse_products(self, content: str) -> SquarespaceParseResult:
        """
        Parse a Squarespace Products CSV export.

        Each physical row becomes a SquarespaceProductRow.  Variant rows
        (where Title is empty) inherit the title of the preceding product.
        """
        result = SquarespaceParseResult()
        reader = csv.DictReader(io.StringIO(content))

        current_title: str = ""
        current_is_physical: bool = False

        for row_number, row in enumerate(reader, start=2):
            result.total_rows += 1

            raw_title = row.get("Title", "").strip()
            product_type = row.get("Product Type [Non Editable]", "").strip().upper()

            # A non-empty Title marks a new product (or the first variant row)
            if raw_title:
                current_title = raw_title
                current_is_physical = product_type == "PHYSICAL"

            # Skip digital / non-physical products entirely
            if not current_is_physical or not current_title:
                continue

            sku = row.get("SKU", "").strip() or None
            gtin = row.get("GTIN", "").strip() or None
            option1 = row.get("Option Value 1", "").strip() or None
            stock_str = row.get("Stock", "0").strip()

            try:
                stock = int(float(stock_str)) if stock_str else 0
            except (ValueError, TypeError):
                stock = 0

            # Re-use the orders-format artist/album parser — handles the same
            # "Artist - Album - Format" and "Album by Artist - Format" patterns.
            artist, album, item_type = _parse_artist_and_album(current_title, sku or "")

            result.rows.append(SquarespaceProductRow(
                row_number=row_number,
                item_name=album,
                artist=artist,
                item_type=item_type,
                sku=sku,
                variant=option1,
                stock_quantity=stock,
                package=current_title,   # full title for _guess_product_format
                upc=gtin if gtin else None,
            ))

        return result

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def parse(self, content: Union[str, bytes]) -> SquarespaceParseResult:
        """
        Parse Squarespace CSV content (auto-detects orders vs products format).

        Args:
            content: CSV file content as string or bytes

        Returns:
            SquarespaceParseResult with parsed rows and errors
        """
        if isinstance(content, bytes):
            try:
                content = content.decode("utf-8-sig")  # Handle BOM
            except UnicodeDecodeError:
                content = content.decode("latin-1")

        # --- Format detection from first header line ---
        first_line = content.split("\n")[0] if content else ""
        if "Order ID" in first_line:
            is_products_format = False
        elif "Product ID" in first_line or "Variant ID" in first_line or "Product Type" in first_line:
            is_products_format = True
        else:
            # Default to orders format for backward-compatibility
            is_products_format = False

        if is_products_format:
            return self._parse_products(content)

        # --- Orders format (original logic) ---
        result = SquarespaceParseResult()

        try:
            orders = self._parse_orders(content)
        except Exception as e:
            result.errors.append(ParseError(
                row_number=0,
                error=f"Failed to parse CSV: {str(e)}",
            ))
            return result

        row_number = 2  # Start after header
        for order_id, order_data in orders.items():
            for item in order_data['items']:
                result.total_rows += 1

                try:
                    parsed_row = self._parse_row(order_data, item, row_number)
                    result.rows.append(parsed_row)
                except (ValueError, KeyError) as e:
                    result.errors.append(ParseError(
                        row_number=row_number,
                        error=str(e),
                        raw_data={'order_id': order_id, 'item': item},
                    ))

                row_number += 1

        return result

    def parse_iter(self, content: Union[str, bytes]) -> Iterator[Union[SquarespaceRow, ParseError]]:
        """
        Parse Squarespace CSV content as an iterator.

        Yields:
            SquarespaceRow or ParseError for each item
        """
        result = self.parse(content)

        for error in result.errors:
            yield error

        for row in result.rows:
            yield row
