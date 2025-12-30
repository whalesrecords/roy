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
from app.services.parsers.believe_uk import BelieveUKRow
from app.services.parsers.believe_fr import BelieveFRRow


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


def normalize_isrc(isrc: Optional[str]) -> Optional[str]:
    """
    Normalize ISRC code by removing dashes and validating format.

    Standard ISRC is 12 alphanumeric characters.
    Some sources include dashes (e.g., FR-9W1-17-07497) which need to be stripped.
    """
    if not isrc:
        return None

    # Remove dashes and whitespace
    cleaned = isrc.replace("-", "").replace(" ", "").strip()

    # ISRC should be 12 characters
    if len(cleaned) > 12:
        cleaned = cleaned[:12]  # Truncate if still too long

    return cleaned if cleaned else None


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
        isrc=normalize_isrc(row.isrc),
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
        sku=row.sku,
        physical_format=row.package,  # "Compact Disc (CD)", "Vinyl LP", etc.
    )


def normalize_believe_uk_sale_type(sale_type: str) -> SaleType:
    """
    Convert Believe UK sale type to SaleType enum.

    Args:
        sale_type: Believe UK sale type (Stream, Creation, PLATFORM PROMOTION, etc.)

    Returns:
        SaleType enum value
    """
    if not sale_type:
        return SaleType.OTHER

    sale_type_lower = sale_type.lower().strip()

    # Streams
    if sale_type_lower in ["stream", "streaming"]:
        return SaleType.STREAM

    # Downloads
    if sale_type_lower in ["download", "téléchargement", "telechargement"]:
        return SaleType.DOWNLOAD

    # Social media usage (Creation = sync to video on FB/Instagram)
    if sale_type_lower in ["creation", "création"]:
        return SaleType.STREAM  # Count as stream equivalent

    # Platform promotions (negative revenue from playlist placements)
    if "platform promotion" in sale_type_lower or "promotion" in sale_type_lower:
        return SaleType.STREAM  # Still streaming activity

    return SaleType.OTHER


def parse_believe_uk_date(date_str: Optional[str]) -> Optional[date]:
    """
    Parse a Believe UK date string into a date object.

    Handles formats like:
    - "2023-02-01" (YYYY-MM-DD)
    - "2025/05/01" (YYYY/MM/DD)
    - "2023-02" (YYYY-MM)
    """
    if not date_str:
        return None

    date_str = date_str.strip()

    # ISO format: YYYY-MM-DD
    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return date.fromisoformat(date_str)

    # Slash format: YYYY/MM/DD (common in newer Believe exports)
    if re.match(r"^\d{4}/\d{2}/\d{2}$", date_str):
        parts = date_str.split("/")
        return date(int(parts[0]), int(parts[1]), int(parts[2]))

    # Try to extract YYYY-MM and use first of month
    if re.match(r"^\d{4}-\d{2}$", date_str):
        year, month = map(int, date_str.split("-"))
        return date(year, month, 1)

    return None


def normalize_believe_uk_row(
    row: BelieveUKRow,
    import_id: str,
    fallback_period_start: date,
    fallback_period_end: date,
) -> TransactionNormalized:
    """
    Transform a parsed Believe UK row into a normalized transaction.

    Args:
        row: Parsed Believe UK row
        import_id: UUID of the parent import
        fallback_period_start: Default period start if not parseable from CSV
        fallback_period_end: Default period end if not parseable from CSV

    Returns:
        TransactionNormalized instance (not yet persisted)
    """
    # Parse dates from row (Believe UK provides reporting_month and sales_month)
    parsed_reporting = parse_believe_uk_date(row.reporting_month)
    parsed_sales = parse_believe_uk_date(row.sales_month)

    # Use sales_month for period if available, else reporting_month, else fallback
    if parsed_sales:
        period_start = parsed_sales
        # End of month
        import calendar
        last_day = calendar.monthrange(parsed_sales.year, parsed_sales.month)[1]
        period_end = date(parsed_sales.year, parsed_sales.month, last_day)
    elif parsed_reporting:
        period_start = parsed_reporting
        import calendar
        last_day = calendar.monthrange(parsed_reporting.year, parsed_reporting.month)[1]
        period_end = date(parsed_reporting.year, parsed_reporting.month, last_day)
    else:
        period_start, period_end = fallback_period_start, fallback_period_end

    # Clean ISRC - Believe uses format with dashes (FR-59R-18-86383) but standard is 12 chars without
    clean_isrc = None
    if row.isrc:
        clean_isrc = row.isrc.replace("-", "").strip()
        # Ensure it's at most 12 characters
        if len(clean_isrc) > 12:
            clean_isrc = clean_isrc[:12]

    return TransactionNormalized(
        import_id=import_id,
        source_row_number=row.row_number,
        artist_name=row.artist,
        release_title=row.release_title or None,
        track_title=row.track_title or None,
        isrc=clean_isrc,
        upc=row.upc,
        territory=normalize_country_code(row.country),
        sale_type=normalize_believe_uk_sale_type(row.sale_type),
        original_sale_type=row.sale_type,
        quantity=row.quantity,
        gross_amount=row.net_revenue,  # Use net revenue (after Believe's cut)
        currency=row.currency.upper() if row.currency else "EUR",
        period_start=period_start,
        period_end=period_end,
        store_name=row.platform,  # Spotify, YouTube UGC, Amazon Premium, etc.
    )


def parse_believe_fr_date(date_str: Optional[str]) -> Optional[date]:
    """
    Parse a Believe FR date string into a date object.

    Handles formats like:
    - "01/09/2025" (DD/MM/YYYY)
    """
    if not date_str:
        return None

    date_str = date_str.strip()

    # DD/MM/YYYY format
    if re.match(r"^\d{2}/\d{2}/\d{4}$", date_str):
        parts = date_str.split("/")
        return date(int(parts[2]), int(parts[1]), int(parts[0]))

    return None


def normalize_believe_fr_sale_type(exploitation_type: str) -> SaleType:
    """
    Convert Believe FR exploitation type to SaleType enum.

    Args:
        exploitation_type: Believe FR exploitation type (Phono, etc.)

    Returns:
        SaleType enum value
    """
    if not exploitation_type:
        return SaleType.OTHER

    exploitation_lower = exploitation_type.lower().strip()

    # Neighboring rights / Phono are typically from radio/streaming royalties
    if exploitation_lower in ["phono", "neighboring rights"]:
        return SaleType.STREAM

    return SaleType.OTHER


def normalize_believe_fr_row(
    row: BelieveFRRow,
    import_id: str,
    fallback_period_start: date,
    fallback_period_end: date,
) -> TransactionNormalized:
    """
    Transform a parsed Believe FR row into a normalized transaction.

    Args:
        row: Parsed Believe FR row
        import_id: UUID of the parent import
        fallback_period_start: Default period start if not parseable from CSV
        fallback_period_end: Default period end if not parseable from CSV

    Returns:
        TransactionNormalized instance (not yet persisted)
    """
    import calendar

    # Parse dates from row
    parsed_reporting = parse_believe_fr_date(row.reporting_date)
    parsed_operation = parse_believe_fr_date(row.operation_date)

    # Use operation_date for period if available, else reporting_date, else fallback
    if parsed_operation:
        period_start = parsed_operation
        last_day = calendar.monthrange(parsed_operation.year, parsed_operation.month)[1]
        period_end = date(parsed_operation.year, parsed_operation.month, last_day)
    elif parsed_reporting:
        period_start = parsed_reporting
        last_day = calendar.monthrange(parsed_reporting.year, parsed_reporting.month)[1]
        period_end = date(parsed_reporting.year, parsed_reporting.month, last_day)
    else:
        period_start, period_end = fallback_period_start, fallback_period_end

    # Clean ISRC if present
    clean_isrc = None
    if row.isrc:
        clean_isrc = row.isrc.replace("-", "").strip()
        if len(clean_isrc) > 12:
            clean_isrc = clean_isrc[:12]

    # Use track_artist for artist name
    artist_name = row.track_artist or row.product_artist

    return TransactionNormalized(
        import_id=import_id,
        source_row_number=row.row_number,
        artist_name=artist_name,
        release_title=row.product_title or None,
        track_title=row.track_title or None,
        isrc=clean_isrc,
        upc=row.upc,
        territory=normalize_country_code(row.country),
        sale_type=normalize_believe_fr_sale_type(row.exploitation_type),
        original_sale_type=row.exploitation_type,
        quantity=row.net_sales,
        gross_amount=row.amount,  # Use final amount after rate
        currency=row.currency.upper() if row.currency else "EUR",
        period_start=period_start,
        period_end=period_end,
        store_name=row.shop,  # GVL (DE), Audiogest (PT), etc.
    )
