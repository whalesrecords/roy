"""
Spotify Ad Studio "Campaigns" CSV parser.

The export has one campaign-level row per campaign (with Budget/Spend filled)
followed by per-audience-segment rows (Budget/Spend = "NA"). We keep only the
campaign-level rows — identified by a numeric Spend — which carry the totals the
artist needs: how much was spent and the results obtained.
"""
import csv
import io
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional


@dataclass
class SpotifyAdRow:
    row_number: int
    artist_name: str
    campaign_name: str
    release_name: Optional[str]
    ad_format: Optional[str]
    release_type: Optional[str]
    country: Optional[str]
    currency: str
    budget: Optional[Decimal]
    spend: Optional[Decimal]
    release_date: Optional[date]
    start_date: Optional[date]
    end_date: Optional[date]
    reach: Optional[int]
    clicks: Optional[int]
    amplified_listeners: Optional[int]
    reactivated_listeners: Optional[int]
    new_active_listeners: Optional[int]
    converted_listeners: Optional[int]
    conversion_rate: Optional[Decimal]
    active_streams_per_listener: Optional[Decimal]
    intent_rate: Optional[Decimal]
    playlist_add_rate: Optional[Decimal]
    playlist_adds: Optional[int]
    save_rate: Optional[Decimal]
    saves: Optional[int]


@dataclass
class ParseError:
    row_number: int
    error: str


@dataclass
class SpotifyAdsParseResult:
    rows: List[SpotifyAdRow] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)
    total_rows: int = 0
    skipped_segment_rows: int = 0


def _clean(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = v.strip().strip('"').strip()
    if s == "" or s.upper() in ("NA", "N/A", "—", "-"):
        return None
    return s


def _to_decimal(v: Optional[str]) -> Optional[Decimal]:
    s = _clean(v)
    if s is None:
        return None
    s = s.replace(",", "").replace(" ", "")
    try:
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return None


def _to_int(v: Optional[str]) -> Optional[int]:
    s = _clean(v)
    if s is None:
        return None
    s = s.replace(",", "").replace(" ", "")
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return None


def _to_rate(v: Optional[str]) -> Optional[Decimal]:
    """'1.47%' -> Decimal('1.47') (percentage value)."""
    s = _clean(v)
    if s is None:
        return None
    s = s.replace("%", "").replace(",", "").strip()
    try:
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return None


def _to_date(v: Optional[str]) -> Optional[date]:
    s = _clean(v)
    if s is None:
        return None
    token = s.split(" ")[0]  # drop trailing "UTC"
    for fmt in ("%m/%d/%y", "%m/%d/%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(token, fmt).date()
        except ValueError:
            continue
    return None


# tolerant header lookup
_ALIASES = {
    "artist_name": ["artist name", "artist"],
    "campaign_name": ["campaign name", "campaign"],
    "release_name": ["release name", "release"],
    "ad_format": ["format"],
    "release_type": ["release type"],
    "country": ["country targeting", "country"],
    "currency": ["currency"],
    "budget": ["budget"],
    "spend": ["spend"],
    "release_date": ["release date"],
    "start_date": ["start date"],
    "end_date": ["end date"],
    "reach": ["reach"],
    "clicks": ["clicks"],
    "amplified_listeners": ["amplified listeners"],
    "reactivated_listeners": ["reactivated listeners"],
    "new_active_listeners": ["new active listeners"],
    "converted_listeners": ["converted listeners"],
    "conversion_rate": ["conversion rate"],
    "active_streams_per_listener": ["active streams per listener"],
    "intent_rate": ["intent rate"],
    "playlist_add_rate": ["playlist add rate"],
    "playlist_adds": ["playlist adds"],
    "save_rate": ["save rate"],
    "saves": ["saves"],
}


class SpotifyAdsParser:
    """Parses a Spotify Ad Studio Campaigns CSV export."""

    def parse(self, content: bytes) -> SpotifyAdsParseResult:
        result = SpotifyAdsParseResult()
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("latin-1")

        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        if not rows:
            return result

        headers = [h.strip().strip('"').lower() for h in rows[0]]

        def idx(field_name: str) -> Optional[int]:
            for alias in _ALIASES.get(field_name, [field_name]):
                if alias in headers:
                    return headers.index(alias)
            return None

        col = {k: idx(k) for k in _ALIASES}

        def get(row: List[str], key: str) -> Optional[str]:
            i = col.get(key)
            if i is None or i >= len(row):
                return None
            return row[i]

        for n, row in enumerate(rows[1:], start=2):
            if not any(c.strip() for c in row):
                continue
            result.total_rows += 1
            spend = _to_decimal(get(row, "spend"))
            # Campaign-level rows have a numeric Spend; per-segment rows are "NA".
            if spend is None:
                result.skipped_segment_rows += 1
                continue
            artist_name = _clean(get(row, "artist_name"))
            campaign_name = _clean(get(row, "campaign_name")) or _clean(get(row, "release_name"))
            if not artist_name or not campaign_name:
                result.errors.append(ParseError(n, "Missing artist or campaign name"))
                continue
            result.rows.append(SpotifyAdRow(
                row_number=n,
                artist_name=artist_name,
                campaign_name=campaign_name,
                release_name=_clean(get(row, "release_name")),
                ad_format=_clean(get(row, "ad_format")),
                release_type=_clean(get(row, "release_type")),
                country=_clean(get(row, "country")),
                currency=(_clean(get(row, "currency")) or "EUR")[:3].upper(),
                budget=_to_decimal(get(row, "budget")),
                spend=spend,
                release_date=_to_date(get(row, "release_date")),
                start_date=_to_date(get(row, "start_date")),
                end_date=_to_date(get(row, "end_date")),
                reach=_to_int(get(row, "reach")),
                clicks=_to_int(get(row, "clicks")),
                amplified_listeners=_to_int(get(row, "amplified_listeners")),
                reactivated_listeners=_to_int(get(row, "reactivated_listeners")),
                new_active_listeners=_to_int(get(row, "new_active_listeners")),
                converted_listeners=_to_int(get(row, "converted_listeners")),
                conversion_rate=_to_rate(get(row, "conversion_rate")),
                active_streams_per_listener=_to_decimal(get(row, "active_streams_per_listener")),
                intent_rate=_to_rate(get(row, "intent_rate")),
                playlist_add_rate=_to_rate(get(row, "playlist_add_rate")),
                playlist_adds=_to_int(get(row, "playlist_adds")),
                save_rate=_to_rate(get(row, "save_rate")),
                saves=_to_int(get(row, "saves")),
            ))

        return result
