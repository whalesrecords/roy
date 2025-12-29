"""
Matching Service for Transaction Correlation.

This service handles matching transactions to canonical entities (artists, releases, tracks)
using both hard matches (ISRC, UPC) and fuzzy matching for Bandcamp physical/package items.
"""

import logging
import re
import unicodedata
from datetime import datetime, date
from typing import Optional, List, Dict, Tuple
from uuid import UUID
from dataclasses import dataclass

from rapidfuzz import fuzz
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import TransactionNormalized, SaleType
from app.models.artist import Artist
from app.models.track_artist_link import TrackArtistLink
from app.models.match_suggestion import MatchSuggestion, MatchMethod, MatchStatus

logger = logging.getLogger(__name__)

# Thresholds for auto-accepting matches
TITLE_MATCH_THRESHOLD = 92
ARTIST_MATCH_THRESHOLD = 95


@dataclass
class MatchResult:
    """Result of a matching operation."""
    processed: int = 0
    hard_matched: int = 0
    auto_accepted: int = 0
    pending: int = 0
    still_unmatched: int = 0


def normalize_text(text: str) -> str:
    """
    Normalize text for fuzzy matching.

    - lowercase
    - remove accents
    - replace & with "and"
    - remove punctuation
    - remove (...) and [...]
    - normalize "feat.", "ft.", "featuring" -> "feat"
    - collapse spaces
    - trim
    """
    if not text:
        return ""

    # Lowercase
    text = text.lower()

    # Remove accents
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')

    # Replace & with "and"
    text = text.replace('&', ' and ')

    # Remove parenthetical content (...) and [...]
    text = re.sub(r'\([^)]*\)', '', text)
    text = re.sub(r'\[[^\]]*\]', '', text)

    # Normalize featuring variations
    text = re.sub(r'\bfeat\.?\b', 'feat', text)
    text = re.sub(r'\bft\.?\b', 'feat', text)
    text = re.sub(r'\bfeaturing\b', 'feat', text)

    # Remove punctuation (keep alphanumeric and spaces)
    text = re.sub(r'[^\w\s]', ' ', text)

    # Collapse multiple spaces and trim
    text = re.sub(r'\s+', ' ', text).strip()

    return text


async def get_artists_lookup(db: AsyncSession) -> Dict[str, Artist]:
    """Get all artists indexed by normalized name."""
    result = await db.execute(select(Artist))
    artists = result.scalars().all()
    return {normalize_text(a.name): a for a in artists}


async def get_isrc_to_artist_map(db: AsyncSession) -> Dict[str, List[Tuple[UUID, str]]]:
    """
    Get mapping from ISRC to linked artist(s).
    Returns dict: isrc -> [(artist_id, artist_name), ...]
    """
    query = (
        select(TrackArtistLink, Artist)
        .join(Artist, TrackArtistLink.artist_id == Artist.id)
    )
    result = await db.execute(query)
    rows = result.all()

    isrc_map: Dict[str, List[Tuple[UUID, str]]] = {}
    for link, artist in rows:
        if link.isrc not in isrc_map:
            isrc_map[link.isrc] = []
        isrc_map[link.isrc].append((artist.id, artist.name))

    return isrc_map


async def match_by_isrc(
    transaction: TransactionNormalized,
    isrc_map: Dict[str, List[Tuple[UUID, str]]],
) -> Optional[Tuple[UUID, str, int]]:
    """
    Try to match transaction by ISRC.
    Returns (artist_id, method, score) or None.
    """
    if not transaction.isrc:
        return None

    linked_artists = isrc_map.get(transaction.isrc)
    if linked_artists and len(linked_artists) == 1:
        artist_id, artist_name = linked_artists[0]
        return (artist_id, MatchMethod.ISRC.value, 100)

    return None


async def match_by_artist_name(
    transaction: TransactionNormalized,
    artists_lookup: Dict[str, Artist],
) -> Optional[Tuple[UUID, str, int]]:
    """
    Try to match transaction by exact artist name (case-insensitive).
    Returns (artist_id, method, score) or None.
    """
    if not transaction.artist_name:
        return None

    normalized_name = normalize_text(transaction.artist_name)
    artist = artists_lookup.get(normalized_name)

    if artist:
        return (artist.id, MatchMethod.FUZZY_ARTIST.value, 100)

    return None


async def generate_fuzzy_suggestions(
    transaction: TransactionNormalized,
    artists_lookup: Dict[str, Artist],
    max_suggestions: int = 5,
) -> List[Dict]:
    """
    Generate fuzzy match suggestions for a transaction.
    Returns list of {artist_id, score, method} dicts.
    """
    if not transaction.artist_name:
        return []

    normalized_tx_artist = normalize_text(transaction.artist_name)
    suggestions = []

    for norm_name, artist in artists_lookup.items():
        if not norm_name:
            continue

        # Calculate fuzzy score
        score = fuzz.ratio(normalized_tx_artist, norm_name)

        # For collaborations, also try partial ratio
        if ' and ' in normalized_tx_artist or ' feat ' in normalized_tx_artist:
            partial_score = fuzz.partial_ratio(normalized_tx_artist, norm_name)
            score = max(score, partial_score)

        if score >= 60:  # Minimum threshold for suggestions
            suggestions.append({
                'artist_id': artist.id,
                'artist_name': artist.name,
                'score': score,
                'method': MatchMethod.FUZZY_ARTIST.value,
            })

    # Sort by score descending and take top N
    suggestions.sort(key=lambda x: x['score'], reverse=True)
    return suggestions[:max_suggestions]


async def process_transaction_matching(
    db: AsyncSession,
    transaction: TransactionNormalized,
    artists_lookup: Dict[str, Artist],
    isrc_map: Dict[str, List[Tuple[UUID, str]]],
    auto_accept: bool = True,
) -> str:
    """
    Process matching for a single transaction.

    Returns: 'hard_matched' | 'auto_accepted' | 'pending' | 'unmatched'
    """
    # Skip if already matched
    if transaction.artist_id is not None:
        return 'already_matched'

    # Strategy A: Hard match by ISRC
    match = await match_by_isrc(transaction, isrc_map)
    if match:
        artist_id, method, score = match
        transaction.artist_id = artist_id
        return 'hard_matched'

    # Strategy A: Hard match by exact artist name
    match = await match_by_artist_name(transaction, artists_lookup)
    if match:
        artist_id, method, score = match
        transaction.artist_id = artist_id
        return 'hard_matched'

    # Strategy B: Fuzzy matching
    suggestions = await generate_fuzzy_suggestions(transaction, artists_lookup)

    if not suggestions:
        return 'unmatched'

    # Store suggestions
    for suggestion in suggestions:
        match_suggestion = MatchSuggestion(
            transaction_id=transaction.id,
            candidate_artist_id=suggestion['artist_id'],
            score=suggestion['score'],
            method=suggestion['method'],
            status=MatchStatus.PENDING.value,
        )

        # Auto-accept if score is high enough
        if auto_accept and suggestion['score'] >= ARTIST_MATCH_THRESHOLD:
            match_suggestion.status = MatchStatus.ACCEPTED.value
            match_suggestion.resolved_by = 'auto'
            match_suggestion.resolved_at = datetime.utcnow()
            transaction.artist_id = suggestion['artist_id']
            db.add(match_suggestion)
            return 'auto_accepted'

        db.add(match_suggestion)

    return 'pending' if suggestions else 'unmatched'


async def run_auto_matching(
    db: AsyncSession,
    import_id: Optional[UUID] = None,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
) -> MatchResult:
    """
    Run automatic matching on transactions.

    Args:
        db: Database session
        import_id: Optional import ID to filter transactions
        period_start: Optional period start date filter
        period_end: Optional period end date filter

    Returns:
        MatchResult with counts
    """
    result = MatchResult()

    # Build query for unmatched transactions
    query = select(TransactionNormalized).where(
        TransactionNormalized.artist_id.is_(None)
    )

    if import_id:
        query = query.where(TransactionNormalized.import_id == import_id)
    if period_start:
        query = query.where(TransactionNormalized.period_start >= period_start)
    if period_end:
        query = query.where(TransactionNormalized.period_end <= period_end)

    tx_result = await db.execute(query)
    transactions = tx_result.scalars().all()

    if not transactions:
        return result

    # Load lookups
    artists_lookup = await get_artists_lookup(db)
    isrc_map = await get_isrc_to_artist_map(db)

    # Process each transaction
    for tx in transactions:
        result.processed += 1
        status = await process_transaction_matching(
            db, tx, artists_lookup, isrc_map, auto_accept=True
        )

        if status == 'hard_matched':
            result.hard_matched += 1
        elif status == 'auto_accepted':
            result.auto_accepted += 1
        elif status == 'pending':
            result.pending += 1
        else:
            result.still_unmatched += 1

    await db.flush()
    return result


async def get_unresolved_suggestions(
    db: AsyncSession,
    import_id: Optional[UUID] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Dict]:
    """
    Get pending match suggestions grouped by transaction.

    Returns list of dicts with transaction info and suggestions.
    """
    # Get pending suggestions with transaction details
    query = (
        select(MatchSuggestion, TransactionNormalized, Artist)
        .join(TransactionNormalized, MatchSuggestion.transaction_id == TransactionNormalized.id)
        .outerjoin(Artist, MatchSuggestion.candidate_artist_id == Artist.id)
        .where(MatchSuggestion.status == MatchStatus.PENDING.value)
        .order_by(MatchSuggestion.score.desc())
    )

    if import_id:
        query = query.where(TransactionNormalized.import_id == import_id)

    result = await db.execute(query)
    rows = result.all()

    # Group by transaction
    tx_suggestions: Dict[UUID, Dict] = {}

    for suggestion, tx, artist in rows:
        tx_id = tx.id

        if tx_id not in tx_suggestions:
            tx_suggestions[tx_id] = {
                'transaction_id': str(tx_id),
                'artist_name': tx.artist_name,
                'track_title': tx.track_title,
                'release_title': tx.release_title,
                'isrc': tx.isrc,
                'upc': tx.upc,
                'gross_amount': str(tx.gross_amount),
                'sale_type': tx.sale_type.value if isinstance(tx.sale_type, SaleType) else tx.sale_type,
                'store_name': tx.store_name,
                'suggestions': [],
            }

        tx_suggestions[tx_id]['suggestions'].append({
            'suggestion_id': str(suggestion.id),
            'candidate_artist_id': str(suggestion.candidate_artist_id) if suggestion.candidate_artist_id else None,
            'candidate_artist_name': artist.name if artist else None,
            'score': suggestion.score,
            'method': suggestion.method,
        })

    # Convert to list and paginate
    result_list = list(tx_suggestions.values())
    return result_list[offset:offset + limit]


async def resolve_suggestion(
    db: AsyncSession,
    suggestion_id: UUID,
    action: str,  # "accept" or "reject"
    resolved_by: str = "user",
) -> Dict:
    """
    Resolve a match suggestion.

    If accepted: apply the match to the transaction, reject other suggestions.
    If rejected: just mark as rejected.

    Returns dict with success status and details.
    """
    # Get the suggestion
    suggestion_query = select(MatchSuggestion).where(MatchSuggestion.id == suggestion_id)
    result = await db.execute(suggestion_query)
    suggestion = result.scalar_one_or_none()

    if not suggestion:
        raise ValueError(f"Suggestion not found: {suggestion_id}")

    if suggestion.status != MatchStatus.PENDING.value:
        raise ValueError(f"Suggestion already resolved: {suggestion.status}")

    now = datetime.utcnow()

    if action == "accept":
        # Mark suggestion as accepted
        suggestion.status = MatchStatus.ACCEPTED.value
        suggestion.resolved_by = resolved_by
        suggestion.resolved_at = now

        # Apply match to transaction
        tx_query = select(TransactionNormalized).where(
            TransactionNormalized.id == suggestion.transaction_id
        )
        tx_result = await db.execute(tx_query)
        transaction = tx_result.scalar_one_or_none()

        if transaction:
            transaction.artist_id = suggestion.candidate_artist_id
            transaction.release_id = suggestion.candidate_release_id
            transaction.track_id = suggestion.candidate_track_id

        # Reject other pending suggestions for this transaction
        other_suggestions_query = select(MatchSuggestion).where(
            and_(
                MatchSuggestion.transaction_id == suggestion.transaction_id,
                MatchSuggestion.id != suggestion_id,
                MatchSuggestion.status == MatchStatus.PENDING.value,
            )
        )
        other_result = await db.execute(other_suggestions_query)
        for other in other_result.scalars().all():
            other.status = MatchStatus.REJECTED.value
            other.resolved_by = resolved_by
            other.resolved_at = now

        await db.flush()
        return {
            "success": True,
            "action": "accepted",
            "transaction_id": str(suggestion.transaction_id),
            "artist_id": str(suggestion.candidate_artist_id) if suggestion.candidate_artist_id else None,
        }

    elif action == "reject":
        suggestion.status = MatchStatus.REJECTED.value
        suggestion.resolved_by = resolved_by
        suggestion.resolved_at = now
        await db.flush()
        return {
            "success": True,
            "action": "rejected",
            "suggestion_id": str(suggestion_id),
        }

    else:
        raise ValueError(f"Invalid action: {action}. Must be 'accept' or 'reject'.")


async def get_matching_stats(
    db: AsyncSession,
    import_id: Optional[UUID] = None,
) -> Dict:
    """Get statistics about matching status."""

    # Base query for transactions
    base_filter = []
    if import_id:
        base_filter.append(TransactionNormalized.import_id == import_id)

    # Total transactions
    total_query = select(func.count(TransactionNormalized.id))
    if base_filter:
        total_query = total_query.where(*base_filter)
    total_result = await db.execute(total_query)
    total = total_result.scalar() or 0

    # Matched transactions
    matched_query = select(func.count(TransactionNormalized.id)).where(
        TransactionNormalized.artist_id.isnot(None)
    )
    if base_filter:
        matched_query = matched_query.where(*base_filter)
    matched_result = await db.execute(matched_query)
    matched = matched_result.scalar() or 0

    # Pending suggestions
    pending_query = select(func.count(func.distinct(MatchSuggestion.transaction_id))).where(
        MatchSuggestion.status == MatchStatus.PENDING.value
    )
    pending_result = await db.execute(pending_query)
    pending = pending_result.scalar() or 0

    return {
        "total_transactions": total,
        "matched": matched,
        "unmatched": total - matched,
        "pending_review": pending,
        "match_rate": round(matched / total * 100, 1) if total > 0 else 0,
    }
