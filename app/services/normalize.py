"""
Normalization Service

Transforms parsed data from various sources into normalized transactions.
"""

import re
from datetime import date
from decimal import Decimal
from typing import Optional, Tuple

from app.models.transaction import TransactionNormalized, SaleType
from app.services.parsers.tunecore import TuneCoreRow
from app.services.parsers.bandcamp import BandcampRow


# Sales type normalization mapping
SALE_TYPE_MAPPING = {
    # Streams
    "stream": SaleType.STREAM,
    "streaming": SaleType.STREAM,
    "audio stream": SaleType.STREAM,
    "video stream": SaleType.STREAM,
    "subscription stream": SaleType.STREAM,
    "ad-supported stream": SaleType.STREAM,
    "premium stream": SaleType.STREAM,
    "free stream": SaleType.STREAM,
    "interactive stream": SaleType.STREAM,
    "on-demand stream": SaleType.STREAM,
    # Downloads
    "download": SaleType.DOWNLOAD,
    "track download": SaleType.DOWNLOAD,
    "album download": SaleType.DOWNLOAD,
    "single download": SaleType.DOWNLOAD,
    "permanent download": SaleType.DOWNLOAD,
    "digital download": SaleType.DOWNLOAD,
    "sale": SaleType.DOWNLOAD,
    "purchase": SaleType.DOWNLOAD,
    # Physical
    "physical": SaleType.PHYSICAL,
    "cd": SaleType.PHYSICAL,
    "vinyl": SaleType.PHYSICAL,
    "cassette": SaleType.PHYSICAL,
    "merchandise": SaleType.PHYSICAL,
}


def normalize_sale_type(raw_type: Optional[str]) -> SaleType:
    """
    Normalize a raw sale type string to a SaleType enum.

    Args:
        raw_type: Original sale type from the source

    Returns:
        Normalized SaleType enum value
    """
    if not raw_type:
        return SaleType.OTHER

    normalized = raw_type.lower().strip()

    # Direct match
    if normalized in SALE_TYPE_MAPPING:
        return SALE_TYPE_MAPPING[normalized]

    # Partial match
    for key, value in SALE_TYPE_MAPPING.items():
        if key in normalized or normalized in key:
            return value

    return SaleType.OTHER


def parse_sales_period(period_str: str) -> Tuple[date, date]:
    """
    Parse a sales period string into start and end dates.

    Handles formats like:
    - "2024-01" -> (2024-01-01, 2024-01-31)
    - "January 2024" -> (2024-01-01, 2024-01-31)
    - "2024-01-01 - 2024-01-31"

    Args:
        period_str: Raw period string

    Returns:
        Tuple of (period_start, period_end)
    """
    import calendar

    period_str = period_str.strip()

    # Format: "YYYY-MM"
    if re.match(r"^\d{4}-\d{2}$", period_str):
        year, month = map(int, period_str.split("-"))
        start = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        end = date(year, month, last_day)
        return start, end

    # Format: "Month YYYY" or "YYYY Month"
    months = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }

    period_lower = period_str.lower()
    for month_name, month_num in months.items():
        if month_name in period_lower:
            # Extract year
            year_match = re.search(r"\d{4}", period_str)
            if year_match:
                year = int(year_match.group())
                start = date(year, month_num, 1)
                last_day = calendar.monthrange(year, month_num)[1]
                end = date(year, month_num, last_day)
                return start, end

    # Format: "YYYY-MM-DD - YYYY-MM-DD" or "YYYY-MM-DD to YYYY-MM-DD"
    date_pattern = r"(\d{4}-\d{2}-\d{2})"
    matches = re.findall(date_pattern, period_str)
    if len(matches) >= 2:
        start = date.fromisoformat(matches[0])
        end = date.fromisoformat(matches[1])
        return start, end

    # Can't parse - raise error
    raise ValueError(f"Cannot parse sales period: {period_str}")


def normalize_country_code(country: Optional[str]) -> Optional[str]:
    """
    Normalize country to ISO 3166-1 alpha-2 code.

    For now, just returns the cleaned value. Can be extended with a
    mapping table for full country names.
    """
    if not country:
        return None

    # Already a 2-letter code
    if len(country) == 2:
        return country.upper()

    # Common mappings
    country_map = {
        "united states": "US",
        "usa": "US",
        "united kingdom": "GB",
        "uk": "GB",
        "germany": "DE",
        "france": "FR",
        "canada": "CA",
        "australia": "AU",
        "japan": "JP",
        "spain": "ES",
        "italy": "IT",
        "brazil": "BR",
        "mexico": "MX",
        "netherlands": "NL",
        "belgium": "BE",
        "sweden": "SE",
        "norway": "NO",
        "denmark": "DK",
        "finland": "FI",
        "switzerland": "CH",
        "austria": "AT",
        "poland": "PL",
        "portugal": "PT",
        "ireland": "IE",
        "new zealand": "NZ",
        "south korea": "KR",
        "india": "IN",
        "china": "CN",
        "russia": "RU",
    }

    normalized = country.lower().strip()
    return country_map.get(normalized, country[:2].upper() if len(country) >= 2 else None)


def normalize_tunecore_row(
    row: TuneCoreRow,
    import_id: str,
    fallback_period_start: date,
    fallback_period_end: date,
) -> TransactionNormalized:
    """
    Transform a parsed TuneCore row into a normalized transaction.

    Args:
        row: Parsed TuneCore row
        import_id: UUID of the parent import
        fallback_period_start: Default period start if not parseable from CSV
        fallback_period_end: Default period end if not parseable from CSV

    Returns:
        TransactionNormalized instance (not yet persisted)
    """
    # Parse period from row or use fallback
    try:
        if row.sales_period:
            period_start, period_end = parse_sales_period(row.sales_period)
        else:
            period_start, period_end = fallback_period_start, fallback_period_end
    except ValueError:
        period_start, period_end = fallback_period_start, fallback_period_end

    return TransactionNormalized(
        import_id=import_id,
        source_row_number=row.row_number,
        artist_name=row.artist,
        release_title=row.release_title or None,
        track_title=row.song_title or None,
        isrc=row.isrc,
        upc=row.upc,
        territory=normalize_country_code(row.country_of_sale),
        sale_type=normalize_sale_type(row.sales_type),
        original_sale_type=row.sales_type,
        quantity=row.units_sold,
        gross_amount=row.total_earned,
        currency=row.currency.upper() if row.currency else "USD",
        period_start=period_start,
        period_end=period_end,
        store_name=row.store_name,
    )


def normalize_bandcamp_item_type(item_type: str) -> SaleType:
    """
    Convert Bandcamp item type to SaleType.

    Args:
        item_type: Bandcamp item type (track, album, package, etc.)

    Returns:
        SaleType enum value
    """
    item_type_lower = item_type.lower().strip() if item_type else ""

    if item_type_lower == "track":
        return SaleType.DOWNLOAD
    elif item_type_lower == "album":
        return SaleType.DOWNLOAD
    elif item_type_lower in ["package", "physical", "merch", "merchandise", "bundle"]:
        return SaleType.PHYSICAL
    else:
        return SaleType.OTHER


def parse_bandcamp_date(date_str: Optional[str]) -> Optional[date]:
    """
    Parse a Bandcamp date string into a date object.

    Handles formats like:
    - "2024-01-15"
    - "2024-01-15 10:30:00"
    - "Jan 15, 2024"
    - "15/01/2024"
    """
    if not date_str:
        return None

    date_str = date_str.strip()

    # ISO format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
    if re.match(r"^\d{4}-\d{2}-\d{2}", date_str):
        return date.fromisoformat(date_str[:10])

    # DD/MM/YYYY or MM/DD/YYYY
    slash_match = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", date_str)
    if slash_match:
        a, b, year = map(int, slash_match.groups())
        # Assume DD/MM/YYYY (European format common in Bandcamp)
        if a > 12:
            return date(year, b, a)  # DD/MM/YYYY
        elif b > 12:
            return date(year, a, b)  # MM/DD/YYYY
        else:
            return date(year, b, a)  # Default to DD/MM/YYYY

    # Month Day, Year (e.g., "Jan 15, 2024")
    months = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }

    for month_abbr, month_num in months.items():
        if month_abbr in date_str.lower():
            day_match = re.search(r"(\d{1,2})", date_str)
            year_match = re.search(r"(\d{4})", date_str)
            if day_match and year_match:
                return date(int(year_match.group()), month_num, int(day_match.group()))

    return None


def normalize_bandcamp_row(
    row: BandcampRow,
    import_id: str,
    fallback_period_start: date,
    fallback_period_end: date,
) -> TransactionNormalized:
    """
    Transform a parsed Bandcamp row into a normalized transaction.

    Args:
        row: Parsed Bandcamp row
        import_id: UUID of the parent import
        fallback_period_start: Default period start if not parseable from CSV
        fallback_period_end: Default period end if not parseable from CSV

    Returns:
        TransactionNormalized instance (not yet persisted)
    """
    # Try to parse dates from row (Bandcamp provides date_from and date_to)
    parsed_date_from = parse_bandcamp_date(row.date_from)
    parsed_date_to = parse_bandcamp_date(row.date_to)

    if parsed_date_from:
        period_start = parsed_date_from
    else:
        period_start = fallback_period_start

    if parsed_date_to:
        period_end = parsed_date_to
    else:
        period_end = fallback_period_end

    # Determine track/release titles based on item type
    track_title = None
    release_title = None

    if row.item_type == "track":
        track_title = row.item_name
        # Use container_name as release title for tracks
        release_title = row.container_name
    elif row.item_type == "album":
        release_title = row.item_name
    else:
        # For packages/physical, use container_name or item_name as release_title
        release_title = row.container_name or row.item_name

    return TransactionNormalized(
        import_id=import_id,
        source_row_number=row.row_number,
        artist_name=row.artist,
        release_title=release_title,
        track_title=track_title,
        isrc=row.isrc,
        upc=row.upc,
        territory=normalize_country_code(row.region),
        sale_type=normalize_bandcamp_item_type(row.item_type),
        original_sale_type=row.item_type,
        quantity=row.quantity,
        gross_amount=row.net_amount,
        currency=row.currency.upper() if row.currency else "EUR",
        period_start=period_start,
        period_end=period_end,
        store_name="Bandcamp",
    )
