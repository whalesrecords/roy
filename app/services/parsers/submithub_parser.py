"""
SubmitHub CSV Parser

Parses SubmitHub promo submission history CSV exports.
Returns raw parsed data for normalization.

SubmitHub CSV columns:
- Song
- Campaign url
- Outlet
- Outlet type (blog, playlist, radio, etc.)
- Action (Listened, Declined, Approved, Shared)
- Feedback
- Sent (date)
- Received (date)
- Listen time (seconds or formatted time)
"""

import csv
import io
from dataclasses import dataclass, field
from typing import Dict, Iterator, List, Optional, Union
from datetime import datetime
import re


@dataclass
class SubmitHubRow:
    """Raw parsed row from SubmitHub CSV."""
    row_number: int
    song_title: str
    artist_name: Optional[str]  # Extracted from campaign URL
    campaign_url: Optional[str]
    outlet_name: str
    outlet_type: Optional[str]
    action: str  # listen, declined, approved, shared
    feedback: Optional[str]
    sent_date: Optional[str]
    received_date: Optional[str]
    listen_time: Optional[int]  # seconds


@dataclass
class ParseError:
    """Represents a parsing error for a specific row."""
    row_number: int
    error: str
    raw_data: Optional[Dict] = None


@dataclass
class SubmitHubParseResult:
    """Result of parsing a SubmitHub CSV."""
    rows: List[SubmitHubRow] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)
    total_rows: int = 0


# Column name mappings - tolerant to variations
COLUMN_MAPPINGS = {
    "song": ["song", "song title", "track", "track name", "title"],
    "campaign_url": ["campaign url", "campaign_url", "url", "link"],
    "campaign_date": ["campaign date", "campaign_date", "date"],
    "outlet": ["outlet", "outlet name", "curator", "blog"],
    "outlet_type": ["outlet type", "outlet_type", "type", "category"],
    "action": ["action", "status", "result", "response"],
    "action_timestamp": ["action timestamp", "action_timestamp", "timestamp"],
    "feedback": ["feedback", "comment", "notes", "review"],
    "additional_notes": ["additional notes", "additional_notes", "notes"],
    "sent": ["sent", "submitted", "submission date", "date sent"],
    "received": ["received", "response date", "date received", "replied"],
    "listen_time": ["listen time", "listen_time", "listened for", "duration", "listen time (seconds)"],
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


def _normalize_action(action_str: str) -> str:
    """Normalize SubmitHub action to standard values."""
    if not action_str:
        return "unknown"

    action_lower = action_str.lower().strip()

    # Map various formats to standard values
    mapping = {
        "listened": "listen",
        "listen": "listen",
        "declined": "declined",
        "decline": "declined",
        "rejected": "declined",
        "approved": "approved",
        "approve": "approved",
        "accepted": "approved",
        "shared": "shared",
        "share": "shared",
        "posted": "shared",
    }

    return mapping.get(action_lower, action_lower)


def _parse_listen_time(time_str: str) -> Optional[int]:
    """Parse listen time to seconds.

    Handles formats like:
    - "180" (seconds)
    - "3:00" (minutes:seconds)
    - "1:30:00" (hours:minutes:seconds)
    """
    if not time_str:
        return None

    time_str = time_str.strip()

    # Try parsing as plain seconds first
    if time_str.isdigit():
        return int(time_str)

    # Try parsing time format (HH:MM:SS or MM:SS)
    time_parts = time_str.split(":")
    try:
        if len(time_parts) == 2:  # MM:SS
            minutes, seconds = map(int, time_parts)
            return minutes * 60 + seconds
        elif len(time_parts) == 3:  # HH:MM:SS
            hours, minutes, seconds = map(int, time_parts)
            return hours * 3600 + minutes * 60 + seconds
    except ValueError:
        pass

    return None


def _parse_date(date_str: str) -> Optional[str]:
    """Parse date string to ISO format.

    Handles common date formats from SubmitHub.
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


def _extract_info_from_campaign_url(url: str) -> tuple[Optional[str], Optional[str]]:
    """Extract artist name and song title from SubmitHub campaign URL.

    Expected format: https://www.submithub.com/by/artist-name/song-title

    Returns:
        (artist_name, song_title) or (None, None) if parsing fails
    """
    if not url:
        return None, None

    # Parse URL pattern: /by/{artist}/{song}
    pattern = r'/by/([^/]+)/([^/?]+)'
    match = re.search(pattern, url)

    if match:
        artist_slug = match.group(1)
        song_slug = match.group(2)

        # Convert slug to readable format: "artist-name" -> "Artist Name"
        artist_name = artist_slug.replace('-', ' ').replace('_', ' ').title()
        song_title = song_slug.replace('-', ' ').replace('_', ' ').title()

        return artist_name, song_title

    return None, None


class SubmitHubParser:
    """Parser for SubmitHub CSV files."""

    def __init__(self):
        self._column_indices: Dict[str, Optional[int]] = {}

    def _detect_columns(self, headers: List[str]) -> None:
        """Detect column indices from headers."""
        for field_name in COLUMN_MAPPINGS:
            self._column_indices[field_name] = _find_column_index(headers, field_name)

        # Validate required columns
        required = ["outlet", "action"]
        missing = [f for f in required if self._column_indices.get(f) is None]
        if missing:
            raise ValueError(f"Missing required columns: {missing}. Available columns: {headers}")

        # Note: "song" column is now optional - we extract from filename or campaign URL

    def _parse_row(self, row: List[str], row_number: int) -> SubmitHubRow:
        """Parse a single CSV row into a SubmitHubRow."""

        # Get campaign URL (might be needed to extract song/artist)
        campaign_url = _get_value(row, self._column_indices.get("campaign_url")) or None

        # Try to get song title from column, or extract from URL
        song_title = _get_value(row, self._column_indices.get("song"))
        artist_name = None

        if not song_title and campaign_url:
            # Extract from campaign URL
            artist_name, song_title = _extract_info_from_campaign_url(campaign_url)

        # If still no song title, use a placeholder - it will be filled from filename
        if not song_title:
            song_title = "Unknown"  # Will be overridden from filename in the API endpoint

        outlet_name = _get_value(row, self._column_indices.get("outlet"))
        if not outlet_name:
            raise ValueError("Missing outlet name")

        action_raw = _get_value(row, self._column_indices.get("action"))
        action = _normalize_action(action_raw)

        listen_time_raw = _get_value(row, self._column_indices.get("listen_time"))
        listen_time = _parse_listen_time(listen_time_raw)

        # Try to get dates from multiple possible columns
        sent_date_raw = _get_value(row, self._column_indices.get("sent")) or _get_value(row, self._column_indices.get("campaign_date"))
        sent_date = _parse_date(sent_date_raw)

        received_date_raw = _get_value(row, self._column_indices.get("received")) or _get_value(row, self._column_indices.get("action_timestamp"))
        received_date = _parse_date(received_date_raw)

        # Combine feedback and additional notes
        feedback = _get_value(row, self._column_indices.get("feedback")) or None
        additional_notes = _get_value(row, self._column_indices.get("additional_notes")) or None
        if feedback and additional_notes:
            feedback = f"{feedback}\n\nAdditional notes: {additional_notes}"
        elif additional_notes:
            feedback = additional_notes

        return SubmitHubRow(
            row_number=row_number,
            song_title=song_title,
            artist_name=artist_name,
            campaign_url=campaign_url,
            outlet_name=outlet_name,
            outlet_type=_get_value(row, self._column_indices.get("outlet_type")) or None,
            action=action,
            feedback=feedback,
            sent_date=sent_date,
            received_date=received_date,
            listen_time=listen_time,
        )

    def parse(self, content: Union[str, bytes]) -> SubmitHubParseResult:
        """
        Parse SubmitHub CSV content.

        Args:
            content: CSV file content as string or bytes

        Returns:
            SubmitHubParseResult with parsed rows and errors
        """
        if isinstance(content, bytes):
            try:
                content = content.decode("utf-8-sig")  # Handle BOM
            except UnicodeDecodeError:
                content = content.decode("latin-1")

        result = SubmitHubParseResult()

        # Detect delimiter (comma, semicolon, or tab)
        sample = content[:2000] if len(content) > 2000 else content
        sniffer = csv.Sniffer()
        try:
            delimiter = sniffer.sniff(sample).delimiter
        except csv.Error:
            # Default to comma if detection fails
            delimiter = ','

        # Use csv.reader for robust parsing
        reader = csv.reader(io.StringIO(content), delimiter=delimiter)

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

    def parse_iter(self, content: Union[str, bytes]) -> Iterator[Union[SubmitHubRow, ParseError]]:
        """
        Parse SubmitHub CSV content as an iterator (memory efficient for large files).

        Yields:
            SubmitHubRow or ParseError for each row
        """
        if isinstance(content, bytes):
            try:
                content = content.decode("utf-8-sig")
            except UnicodeDecodeError:
                content = content.decode("latin-1")

        # Detect delimiter (comma, semicolon, or tab)
        sample = content[:2000] if len(content) > 2000 else content
        sniffer = csv.Sniffer()
        try:
            delimiter = sniffer.sniff(sample).delimiter
        except csv.Error:
            # Default to comma if detection fails
            delimiter = ','

        reader = csv.reader(io.StringIO(content), delimiter=delimiter)

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
