"""
Groover CSV Parser

Parses Groover promo submission history CSV exports.
Returns raw parsed data for normalization.

Groover CSV columns:
- Band
- Track
- Track link
- Influencer
- Type (playlist, feedback-only, social-media-sharing)
- Decisions
- Feedback
- Sharing Link
- Sent (date)
- Answer date
"""

import csv
import io
from dataclasses import dataclass, field
from typing import Dict, Iterator, List, Optional, Union
from datetime import datetime


@dataclass
class GrooverRow:
    """Raw parsed row from Groover CSV."""
    row_number: int
    band_name: str
    track_title: str
    track_link: Optional[str]
    influencer_name: str
    influencer_type: Optional[str]  # playlist, feedback-only, social-media-sharing
    decision: Optional[str]
    feedback: Optional[str]
    sharing_link: Optional[str]
    sent_date: Optional[str]
    answer_date: Optional[str]


@dataclass
class ParseError:
    """Represents a parsing error for a specific row."""
    row_number: int
    error: str
    raw_data: Optional[Dict] = None


@dataclass
class GrooverParseResult:
    """Result of parsing a Groover CSV."""
    rows: List[GrooverRow] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)
    total_rows: int = 0


# Column name mappings - tolerant to variations
COLUMN_MAPPINGS = {
    "band": ["band", "artist", "artist name", "band name"],
    "track": ["track", "song", "track name", "song title", "title"],
    "track_link": ["track link", "track_link", "link", "url", "track url"],
    "influencer": ["influencer", "curator", "contact", "influencer name"],
    "type": ["type", "influencer type", "category", "contact type"],
    "decisions": ["decisions", "decision", "status", "result", "response"],
    "feedback": ["feedback", "comment", "notes", "review", "message"],
    "sharing_link": ["sharing link", "sharing_link", "share link", "playlist link", "post link"],
    "sent": ["sent", "submitted", "submission date", "date sent", "sent date"],
    "answer_date": ["answer date", "answer_date", "response date", "replied", "date answered"],
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


def _normalize_type(type_str: str) -> Optional[str]:
    """Normalize Groover influencer type to standard values."""
    if not type_str:
        return None

    type_lower = type_str.lower().strip()

    # Map various formats to standard values
    if "playlist" in type_lower:
        return "playlist"
    elif "feedback" in type_lower or "only" in type_lower:
        return "feedback-only"
    elif "social" in type_lower or "media" in type_lower or "sharing" in type_lower:
        return "social-media-sharing"
    elif "radio" in type_lower:
        return "radio"
    elif "blog" in type_lower:
        return "blog"

    # Return normalized (lowercase, replace spaces with hyphens)
    return type_lower.replace(" ", "-")


def _parse_date(date_str: str) -> Optional[str]:
    """Parse date string to ISO format.

    Handles common date formats from Groover.
    Returns ISO format string or None if parsing fails.
    """
    if not date_str:
        return None

    date_str = date_str.strip()
    if not date_str:
        return None

    # Common formats to try
    formats = [
        "%Y-%m-%d",           # 2026-01-27
        "%m/%d/%Y",           # 01/27/2026
        "%d/%m/%Y",           # 27/01/2026
        "%Y/%m/%d",           # 2026/01/27
        "%b %d, %Y",          # Jan 27, 2026
        "%B %d, %Y",          # January 27, 2026
        "%d %b %Y",           # 27 Jan 2026
        "%d %B %Y",           # 27 January 2026
        "%d.%m.%Y",           # 27.01.2026 (European)
        "%Y.%m.%d",           # 2026.01.27
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.date().isoformat()
        except ValueError:
            continue

    # If all formats fail, return the original string
    # (will be validated later in the API layer)
    return date_str


class GrooverParser:
    """Parser for Groover CSV files."""

    def __init__(self):
        self._column_indices: Dict[str, Optional[int]] = {}

    def _detect_columns(self, headers: List[str]) -> None:
        """Detect column indices from headers."""
        for field_name in COLUMN_MAPPINGS:
            self._column_indices[field_name] = _find_column_index(headers, field_name)

        # Validate required columns
        required = ["track", "influencer", "decisions"]
        missing = [f for f in required if self._column_indices.get(f) is None]
        if missing:
            raise ValueError(f"Missing required columns: {missing}. Available columns: {headers}")

    def _parse_row(self, row: List[str], row_number: int) -> GrooverRow:
        """Parse a single CSV row into a GrooverRow."""

        track_title = _get_value(row, self._column_indices.get("track"))
        if not track_title:
            raise ValueError("Missing track title")

        influencer_name = _get_value(row, self._column_indices.get("influencer"))
        if not influencer_name:
            raise ValueError("Missing influencer name")

        band_name = _get_value(row, self._column_indices.get("band"))
        if not band_name:
            # Try to extract from track title if it contains " - "
            if " - " in track_title:
                parts = track_title.split(" - ", 1)
                band_name = parts[0].strip()
                track_title = parts[1].strip()
            else:
                band_name = "Unknown Artist"

        type_raw = _get_value(row, self._column_indices.get("type"))
        influencer_type = _normalize_type(type_raw)

        sent_date_raw = _get_value(row, self._column_indices.get("sent"))
        sent_date = _parse_date(sent_date_raw)

        answer_date_raw = _get_value(row, self._column_indices.get("answer_date"))
        answer_date = _parse_date(answer_date_raw)

        return GrooverRow(
            row_number=row_number,
            band_name=band_name,
            track_title=track_title,
            track_link=_get_value(row, self._column_indices.get("track_link")) or None,
            influencer_name=influencer_name,
            influencer_type=influencer_type,
            decision=_get_value(row, self._column_indices.get("decisions")) or None,
            feedback=_get_value(row, self._column_indices.get("feedback")) or None,
            sharing_link=_get_value(row, self._column_indices.get("sharing_link")) or None,
            sent_date=sent_date,
            answer_date=answer_date,
        )

    def parse(self, content: Union[str, bytes]) -> GrooverParseResult:
        """
        Parse Groover CSV content.

        Args:
            content: CSV file content as string or bytes

        Returns:
            GrooverParseResult with parsed rows and errors
        """
        if isinstance(content, bytes):
            try:
                content = content.decode("utf-8-sig")  # Handle BOM
            except UnicodeDecodeError:
                content = content.decode("latin-1")

        result = GrooverParseResult()

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

    def parse_iter(self, content: Union[str, bytes]) -> Iterator[Union[GrooverRow, ParseError]]:
        """
        Parse Groover CSV content as an iterator (memory efficient for large files).

        Yields:
            GrooverRow or ParseError for each row
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
