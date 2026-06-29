"""
Meta (Facebook / Instagram) Ads Manager CSV parser.

The export has one row per ad ("Publicités"), with reach, impressions, spend and
engagement metrics, plus a reporting period (Début/Fin des rapports). Meta often
TRUNCATES the ad name (it can end with "by..."), so the artist is detected from
the title embedded in the ad name (e.g. "Publication Instagram : Oceanos (SOS) by
…") matched against the catalogue, with a manual artist override as a fallback.

French column headers are matched tolerantly. Numbers may use a dot or a comma as
the decimal separator, and a non-breaking space as the thousands separator.
"""
import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import List, Optional


@dataclass
class MetaAdRow:
    row_number: int
    ad_name: str
    platform: Optional[str]        # Instagram / Facebook
    title: Optional[str]           # parsed from the ad name (release/track title)
    artist_hint: Optional[str]     # parsed "by X" if present and not truncated
    currency: str
    spend: Optional[Decimal]
    reach: Optional[int]
    impressions: Optional[int]
    link_clicks: Optional[int]
    clicks_all: Optional[int]
    results: Optional[int]
    result_type: Optional[str]
    cpc: Optional[Decimal]
    cpm: Optional[Decimal]
    ctr: Optional[Decimal]
    start_date: Optional[date]
    end_date: Optional[date]


@dataclass
class ParseError:
    row_number: int
    error: str


@dataclass
class MetaAdsParseResult:
    rows: List[MetaAdRow] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)
    total_rows: int = 0
    skipped_no_spend: int = 0


def _clean(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = v.replace("\xa0", " ").strip().strip('"').strip()
    if s == "" or s.upper() in ("NA", "N/A", "—", "-"):
        return None
    return s


def _to_decimal(v: Optional[str]) -> Optional[Decimal]:
    s = _clean(v)
    if s is None:
        return None
    s = s.replace("%", "").replace(" ", "").replace("\xa0", "")
    # Decimal separator: if both "," and "." present, "," is thousands → drop it.
    # If only "," present, treat it as the decimal separator.
    if "," in s and "." in s:
        s = s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return None


def _to_int(v: Optional[str]) -> Optional[int]:
    d = _to_decimal(v)
    if d is None:
        return None
    try:
        return int(d)
    except (ValueError, TypeError):
        return None


def _to_date(v: Optional[str]) -> Optional[date]:
    s = _clean(v)
    if s is None:
        return None
    token = s.split(" ")[0]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(token, fmt).date()
        except ValueError:
            continue
    return None


def _parse_ad_name(ad_name: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Returns (platform, title, artist_hint) parsed from a Meta ad name such as
    "Publication Instagram : Oceanos (SOS) by Artiste" (the "by …" part is often
    truncated by Meta, in which case artist_hint is None).
    """
    if not ad_name:
        return None, None, None
    name = ad_name.replace("\xa0", " ").strip()

    platform = None
    low = name.lower()
    if "instagram" in low:
        platform = "Instagram"
    elif "facebook" in low:
        platform = "Facebook"

    # Drop a leading label like "Publication Instagram :" / "Publication Facebook :"
    core = name.split(":", 1)[1].strip() if ":" in name else name

    # Split off a trailing " by <artist>" (case-insensitive).
    artist_hint = None
    title = core
    m = re.search(r"\bby\b", core, flags=re.IGNORECASE)
    if m:
        title = core[: m.start()].strip(" -–—")
        after = core[m.end():].strip(" -–—")
        # Meta truncates with an ellipsis; "by..." carries no usable artist.
        if after and after not in (".", "..", "...", "…") and not after.startswith("..."):
            artist_hint = after
    return platform, (title or None), artist_hint


# Tolerant header lookup (lowercased, nbsp-normalised). First alias found wins.
_ALIASES = {
    "ad_name": ["publicités", "publicite", "publicités", "ad name", "nom de la publicité"],
    "reach": ["couverture", "reach"],
    "impressions": ["impressions"],
    "spend": ["montant dépensé (eur)", "montant dépensé", "amount spent (eur)", "amount spent"],
    "link_clicks": ["clics sur un lien", "link clicks"],
    "clicks_all": ["clics (tous)", "clicks (all)"],
    "results": ["résultats", "results"],
    "result_type": ["type de résultat", "result type"],
    "cpc": ["cpc (coût par clic sur un lien)", "cpc (cost per link click)", "cpc"],
    "cpm": ["cpm (coût pour 1 000 impressions)", "cpm (cost per 1,000 impressions)", "cpm"],
    "ctr": ["ctr (tous)", "ctr (all)", "ctr"],
    "start_date": ["début des rapports", "reporting starts"],
    "end_date": ["fin des rapports", "reporting ends"],
}


class MetaAdsParser:
    """Parses a Meta (Facebook/Instagram) Ads Manager CSV export."""

    def parse(self, content: bytes) -> MetaAdsParseResult:
        result = MetaAdsParseResult()
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("latin-1")

        rows = list(csv.reader(io.StringIO(text)))
        if not rows:
            return result

        headers = [h.replace("\xa0", " ").strip().strip('"').lower() for h in rows[0]]

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
            ad_name = _clean(get(row, "ad_name"))
            if not ad_name:
                result.errors.append(ParseError(n, "Nom de publicité manquant"))
                continue
            spend = _to_decimal(get(row, "spend"))
            if spend is None:
                result.skipped_no_spend += 1
                continue

            platform, title, artist_hint = _parse_ad_name(ad_name)
            result.rows.append(MetaAdRow(
                row_number=n,
                ad_name=ad_name,
                platform=platform,
                title=title,
                artist_hint=artist_hint,
                currency="EUR",
                spend=spend,
                reach=_to_int(get(row, "reach")),
                impressions=_to_int(get(row, "impressions")),
                link_clicks=_to_int(get(row, "link_clicks")),
                clicks_all=_to_int(get(row, "clicks_all")),
                results=_to_int(get(row, "results")),
                result_type=_clean(get(row, "result_type")),
                cpc=_to_decimal(get(row, "cpc")),
                cpm=_to_decimal(get(row, "cpm")),
                ctr=_to_decimal(get(row, "ctr")),
                start_date=_to_date(get(row, "start_date")),
                end_date=_to_date(get(row, "end_date")),
            ))

        return result
