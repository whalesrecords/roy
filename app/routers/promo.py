"""
Promo Router

Handles promo submission imports (SubmitHub, Groover) and management.
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_

from app.core.config import settings
from app.core.database import get_db
from app.models.promo_submission import PromoSubmission, PromoSource
from app.models.promo_campaign import PromoCampaign, CampaignStatus
from app.models.artist import Artist
from app.models.artwork import TrackArtwork, ReleaseArtwork
from app.models.advance_ledger import AdvanceLedgerEntry, ExpenseCategory, LedgerEntryType
from app.schemas.promo import (
    SubmitHubAnalyzeResponse,
    GrooverAnalyzeResponse,
    ImportSubmitHubResponse,
    ImportGrooverResponse,
    PromoSubmissionsListResponse,
    PromoSubmissionResponse,
    PromoStatsResponse,
    DetailedPromoStatsResponse,
    ArtistPromoStats,
    AlbumPromoStats,
    SongMatch,
    PromoCampaignCreate,
    PromoCampaignResponse,
    TracksSummaryResponse,
    TrackSummary,
)
from app.services.parsers.submithub_parser import SubmitHubParser, SubmitHubRow, ParseError as SubmitHubParseError
from app.services.parsers.groover_parser import GrooverParser, GrooverRow, ParseError as GrooverParseError


router = APIRouter(prefix="/promo", tags=["promo"])


async def verify_admin_token(x_admin_token: Annotated[str, Header()]) -> str:
    """Verify the admin token from header."""
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )
    return x_admin_token


def normalize_artist_name(name: str) -> str:
    """
    Normalize artist name by removing accents and special characters.

    Converts: ø -> o, æ -> ae, å -> a, etc.
    """
    import unicodedata
    # Normalize unicode to NFD (decomposed form)
    nfd = unicodedata.normalize('NFD', name)
    # Remove combining characters (accents)
    ascii_name = ''.join(c for c in nfd if not unicodedata.combining(c))
    # Additional special character replacements
    replacements = {
        'ø': 'o', 'Ø': 'O',
        'æ': 'ae', 'Æ': 'AE',
        'å': 'a', 'Å': 'A',
        'ł': 'l', 'Ł': 'L',
    }
    for old, new in replacements.items():
        ascii_name = ascii_name.replace(old, new)
    return ascii_name.strip()


async def match_artist_by_name(
    artist_name: str,
    db: AsyncSession,
) -> Optional[UUID]:
    """
    Match artist name to existing artist in database.

    Tries normalized matching to handle special characters like ø, æ, etc.

    Returns:
        artist_id or None if no match
    """
    if not artist_name:
        return None

    # First: exact match (case-insensitive)
    result = await db.execute(
        select(Artist)
        .where(func.lower(Artist.name) == func.lower(artist_name.strip()))
    )
    artist = result.scalar_one_or_none()
    if artist:
        return artist.id

    # Second: normalized match (handle special characters)
    normalized_input = normalize_artist_name(artist_name.strip()).lower()

    # Get all artists and check normalized names
    result = await db.execute(select(Artist))
    all_artists = result.scalars().all()

    for artist in all_artists:
        if normalize_artist_name(artist.name).lower() == normalized_input:
            return artist.id

    # Third: try partial match (artist name contains or is contained in database name)
    result = await db.execute(
        select(Artist)
        .where(or_(
            func.lower(Artist.name).contains(func.lower(artist_name.strip())),
            func.lower(artist_name.strip()).contains(func.lower(Artist.name))
        ))
    )
    artist = result.scalar_one_or_none()
    if artist:
        return artist.id

    # TODO: Implement fuzzy matching with Levenshtein distance for better matching
    return None


async def match_song_to_catalog(
    song_title: str,
    artist_id: UUID,
    db: AsyncSession,
) -> tuple[Optional[str], Optional[str]]:
    """
    Match song title to existing catalog (TrackArtwork or ReleaseArtwork).

    Note: TrackArtwork and ReleaseArtwork don't have artist_id, so we match
    only on title. This may return multiple matches if same title exists
    for different artists, but we return the first match found.

    Returns:
        (track_isrc, release_upc) or (None, None) if no match
    """
    # First: exact match on TrackArtwork.name
    result = await db.execute(
        select(TrackArtwork)
        .where(func.lower(TrackArtwork.name) == func.lower(song_title))
    )
    track = result.scalar_one_or_none()
    if track:
        return track.isrc, track.release_upc

    # Second: exact match on ReleaseArtwork.name
    result = await db.execute(
        select(ReleaseArtwork)
        .where(func.lower(ReleaseArtwork.name) == func.lower(song_title))
    )
    release = result.scalar_one_or_none()
    if release:
        return None, release.upc

    # TODO: Implement fuzzy matching with Levenshtein distance
    # For MVP, return None if no exact match
    return None, None


def extract_artist_song_from_filename(filename: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extract artist name and song title from SubmitHub filename.

    Expected format: "Artist Name - Song Title.csv"

    Returns:
        (artist_name, song_title) or (None, None) if parsing fails
    """
    if not filename:
        return None, None

    # Remove .csv extension
    name_without_ext = filename.replace('.csv', '').strip()

    # Split by " - " (space-dash-space)
    if ' - ' in name_without_ext:
        parts = name_without_ext.split(' - ', 1)  # Split only on first occurrence
        if len(parts) == 2:
            artist_name = parts[0].strip()
            song_title = parts[1].strip()
            return artist_name, song_title

    return None, None


@router.post("/import/submithub/analyze", response_model=SubmitHubAnalyzeResponse)
async def analyze_submithub_csv(
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> SubmitHubAnalyzeResponse:
    """
    Analyze a SubmitHub CSV file before importing.
    Returns column detection, sample rows, artist detection, and warnings.

    Artist and song title are extracted from the filename format: "Artist Name - Song Title.csv"
    """
    # Extract artist and song from filename
    artist_name, song_title = extract_artist_song_from_filename(file.filename or "")

    content = await file.read()
    parser = SubmitHubParser()

    try:
        result = parser.parse(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {str(e)}",
        )

    # Use filename artist/song as fallback only if row doesn't have them
    if artist_name or song_title:
        for row in result.rows:
            if artist_name and not row.artist_name:
                row.artist_name = artist_name
            if song_title and (not row.song_title or row.song_title == "Unknown"):
                row.song_title = song_title

    # Get sample rows (first 5)
    sample_rows = []
    for row in result.rows[:5]:
        sample_rows.append({
            "song_title": row.song_title,
            "artist_name": row.artist_name,
            "outlet_name": row.outlet_name,
            "action": row.action,
            "feedback": row.feedback[:100] + "..." if row.feedback and len(row.feedback) > 100 else row.feedback,
            "sent_date": row.sent_date,
        })

    # Collect warnings
    warnings = []
    if result.errors:
        warnings.append(f"{len(result.errors)} rows had parsing errors")

    if not artist_name:
        warnings.append("Could not extract artist name from filename (expected format: 'Artist Name - Song Title.csv')")
    if not song_title:
        warnings.append("Could not extract song title from filename (expected format: 'Artist Name - Song Title.csv')")

    # Detect unique artists
    artists_found = set()
    if artist_name:
        artists_found.add(artist_name)

    # Detect columns from first row
    columns_detected = []
    if result.rows:
        first_row = result.rows[0]
        if first_row.song_title:
            columns_detected.append("Song (from filename)")
        if first_row.artist_name:
            columns_detected.append("Artist (from filename)")
        if first_row.outlet_name:
            columns_detected.append("Outlet")
        if first_row.action:
            columns_detected.append("Action")
        if first_row.campaign_url:
            columns_detected.append("Campaign url")
        if first_row.outlet_type:
            columns_detected.append("Outlet type")
        if first_row.feedback:
            columns_detected.append("Feedback")
        if first_row.sent_date:
            columns_detected.append("Sent")
        if first_row.received_date:
            columns_detected.append("Received")

    return SubmitHubAnalyzeResponse(
        total_rows=len(result.rows),
        sample_rows=sample_rows,
        columns_detected=columns_detected,
        warnings=warnings,
        artists_found=list(artists_found),
    )


@router.post("/import/submithub", response_model=ImportSubmitHubResponse)
async def import_submithub_csv(
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    artist_id: Annotated[Optional[str], Form()] = None,
    campaign_name: Annotated[Optional[str], Form()] = None,
    budget: Annotated[Optional[str], Form()] = None,
) -> ImportSubmitHubResponse:
    """
    Import SubmitHub CSV file.

    If artist_id is provided, all submissions go to that artist.
    Otherwise, artist names are extracted from campaign URLs and matched automatically.

    Creates PromoSubmissions, optionally creates PromoCampaign, and links to catalog.
    """
    try:
        # Validate artist if provided
        artist_uuid = None
        if artist_id:
            try:
                artist_uuid = UUID(artist_id)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid artist_id format",
                )

            result = await db.execute(select(Artist).where(Artist.id == artist_uuid))
            artist = result.scalar_one_or_none()
            if not artist:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Artist not found",
                )

        # Extract artist and song from filename
        filename_artist, filename_song = extract_artist_song_from_filename(file.filename or "")

        # Parse CSV
        content = await file.read()
        parser = SubmitHubParser()

        try:
            parse_result = parser.parse(content)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse CSV: {str(e)}",
            )

        # Use filename artist/song as fallback only if row doesn't have them
        if filename_artist or filename_song:
            for row in parse_result.rows:
                if filename_artist and not row.artist_name:
                    row.artist_name = filename_artist
                if filename_song and (not row.song_title or row.song_title == "Unknown"):
                    row.song_title = filename_song

        # Create campaign if name provided (only if single artist)
        campaign = None
        if campaign_name and artist_uuid:
            campaign = PromoCampaign(
                artist_id=artist_uuid,
                name=campaign_name,
                source=PromoSource.SUBMITHUB,
                budget=Decimal(budget) if budget else None,
                status=CampaignStatus.ACTIVE,
                started_at=datetime.utcnow().date(),
            )
            db.add(campaign)
            await db.flush()

        # Process rows
        submissions = []
        matched_songs = []
        unmatched_songs = []
        errors = []
        artists_not_found = set()

        for row in parse_result.rows:
            # Determine which artist this submission belongs to
            row_artist_id = artist_uuid  # Use provided artist if set

            if not row_artist_id and row.artist_name:
                # Try to match artist by name
                row_artist_id = await match_artist_by_name(row.artist_name, db)
                if not row_artist_id:
                    artists_not_found.add(row.artist_name)
                    errors.append(f"Row {row.row_number}: Artist '{row.artist_name}' not found in database")
                    continue  # Skip this row

            if not row_artist_id:
                errors.append(f"Row {row.row_number}: No artist specified and couldn't extract from filename")
                continue

            # Match song to catalog
            track_isrc, release_upc = await match_song_to_catalog(row.song_title, row_artist_id, db)

            match_info = SongMatch(
                song_title=row.song_title,
                track_isrc=track_isrc,
                release_upc=release_upc,
                match_confidence="exact" if track_isrc or release_upc else "none",
            )

            if track_isrc or release_upc:
                matched_songs.append(match_info)
            else:
                unmatched_songs.append(row.song_title)

            # Parse dates (already in ISO format from parser)
            submitted_at = None
            if row.sent_date:
                try:
                    parsed_date = date.fromisoformat(row.sent_date)
                    submitted_at = datetime.combine(parsed_date, datetime.min.time())
                except (ValueError, TypeError):
                    pass

            responded_at = None
            if row.received_date:
                try:
                    parsed_date = date.fromisoformat(row.received_date)
                    responded_at = datetime.combine(parsed_date, datetime.min.time())
                except (ValueError, TypeError):
                    pass

            submission = PromoSubmission(
                artist_id=row_artist_id,
                release_upc=release_upc,
                track_isrc=track_isrc,
                song_title=row.song_title,
                source=PromoSource.SUBMITHUB,
                campaign_id=campaign.id if campaign else None,
                campaign_url=row.campaign_url,
                outlet_name=row.outlet_name,
                outlet_type=row.outlet_type,
                action=row.action,
                listen_time=row.listen_time,
                feedback=row.feedback,
                submitted_at=submitted_at,
                responded_at=responded_at,
            )
            submissions.append(submission)

        # Batch insert
        db.add_all(submissions)

        # Create advance ledger entry if budget specified
        if budget and campaign:
            ledger_entry = AdvanceLedgerEntry(
                artist_id=artist_uuid,
                category=ExpenseCategory.SUBMITHUB.value,
                amount=Decimal(budget),  # Positive amount (expense is an advance)
                entry_type=LedgerEntryType.ADVANCE,
                description=f"SubmitHub campaign: {campaign_name}",
                effective_date=datetime.utcnow(),
            )
            db.add(ledger_entry)

        await db.commit()

        # Collect parse errors
        for err in parse_result.errors:
            errors.append(f"Row {err.row_number}: {err.error}")

        return ImportSubmitHubResponse(
            created_count=len(submissions),
            matched_songs=matched_songs,
            unmatched_songs=unmatched_songs,
            campaign_id=campaign.id if campaign else None,
            errors=errors,
        )

    except HTTPException:
        # Re-raise HTTPExceptions (already formatted)
        raise
    except Exception as e:
        # Log the full exception for debugging
        import traceback
        print(f"Error in import_submithub_csv: {str(e)}")
        print(traceback.format_exc())

        # Rollback transaction
        await db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error during import: {str(e)}",
        )


@router.post("/import/groover/analyze", response_model=GrooverAnalyzeResponse)
async def analyze_groover_csv(
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> GrooverAnalyzeResponse:
    """
    Analyze a Groover CSV file before importing.
    Returns column detection, sample rows, and warnings.
    """
    content = await file.read()
    parser = GrooverParser()

    try:
        result = parser.parse(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {str(e)}",
        )

    # Get sample rows (first 5)
    sample_rows = []
    for row in result.rows[:5]:
        sample_rows.append({
            "band_name": row.band_name,
            "track_title": row.track_title,
            "influencer_name": row.influencer_name,
            "decision": row.decision,
            "feedback": row.feedback[:100] + "..." if row.feedback and len(row.feedback) > 100 else row.feedback,
            "sent_date": row.sent_date,
        })

    # Collect warnings
    warnings = []
    if result.errors:
        warnings.append(f"{len(result.errors)} rows had parsing errors")

    # Detect columns from first row
    columns_detected = []
    if result.rows:
        first_row = result.rows[0]
        if first_row.band_name:
            columns_detected.append("Band")
        if first_row.track_title:
            columns_detected.append("Track")
        if first_row.influencer_name:
            columns_detected.append("Influencer")
        if first_row.influencer_type:
            columns_detected.append("Type")
        if first_row.decision:
            columns_detected.append("Decisions")
        if first_row.feedback:
            columns_detected.append("Feedback")
        if first_row.sharing_link:
            columns_detected.append("Sharing Link")
        if first_row.sent_date:
            columns_detected.append("Sent")

    return GrooverAnalyzeResponse(
        total_rows=len(result.rows),
        sample_rows=sample_rows,
        columns_detected=columns_detected,
        warnings=warnings,
    )


@router.post("/import/groover", response_model=ImportGrooverResponse)
async def import_groover_csv(
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    artist_id: Annotated[Optional[str], Form()] = None,
    campaign_name: Annotated[Optional[str], Form()] = None,
    budget: Annotated[Optional[str], Form()] = None,
) -> ImportGrooverResponse:
    """
    Import Groover CSV file.

    If artist_id is provided, all submissions go to that artist.
    Otherwise, artist names are extracted from band column and matched automatically.

    Creates PromoSubmissions, optionally creates PromoCampaign, and links to catalog.
    """
    try:
        # Validate artist if provided
        artist_uuid = None
        if artist_id:
            try:
                artist_uuid = UUID(artist_id)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid artist_id format",
                )

            result = await db.execute(select(Artist).where(Artist.id == artist_uuid))
            artist = result.scalar_one_or_none()
            if not artist:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Artist not found",
                )

        # Parse CSV
        content = await file.read()
        parser = GrooverParser()

        try:
            parse_result = parser.parse(content)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse CSV: {str(e)}",
            )

        # Create campaign if name provided (only if single artist)
        campaign = None
        if campaign_name and artist_uuid:
            campaign = PromoCampaign(
                artist_id=artist_uuid,
                name=campaign_name,
                source=PromoSource.GROOVER,
                budget=Decimal(budget) if budget else None,
                status=CampaignStatus.ACTIVE,
                started_at=datetime.utcnow().date(),
            )
            db.add(campaign)
            await db.flush()

        # Process rows
        submissions = []
        matched_songs = []
        unmatched_songs = []
        errors = []
        artists_not_found = set()

        for row in parse_result.rows:
            # Determine which artist this submission belongs to
            row_artist_id = artist_uuid  # Use provided artist if set

            if not row_artist_id and row.band_name:
                # Try to match artist by name
                row_artist_id = await match_artist_by_name(row.band_name, db)
                if not row_artist_id:
                    artists_not_found.add(row.band_name)
                    errors.append(f"Row {row.row_number}: Artist '{row.band_name}' not found in database")
                    continue  # Skip this row

            if not row_artist_id:
                errors.append(f"Row {row.row_number}: No artist specified and couldn't extract from CSV")
                continue

            # Match song to catalog
            track_isrc, release_upc = await match_song_to_catalog(row.track_title, row_artist_id, db)

            match_info = SongMatch(
                song_title=row.track_title,
                track_isrc=track_isrc,
                release_upc=release_upc,
                match_confidence="exact" if track_isrc or release_upc else "none",
            )

            if track_isrc or release_upc:
                matched_songs.append(match_info)
            else:
                unmatched_songs.append(row.track_title)

            # Create submission
            # Parse dates (already in ISO format from parser)
            submitted_at = None
            if row.sent_date:
                try:
                    parsed_date = date.fromisoformat(row.sent_date)
                    submitted_at = datetime.combine(parsed_date, datetime.min.time())
                except (ValueError, TypeError):
                    pass

            responded_at = None
            if row.answer_date:
                try:
                    parsed_date = date.fromisoformat(row.answer_date)
                    responded_at = datetime.combine(parsed_date, datetime.min.time())
                except (ValueError, TypeError):
                    pass

            submission = PromoSubmission(
                artist_id=row_artist_id,
                release_upc=release_upc,
                track_isrc=track_isrc,
                song_title=row.track_title,
                source=PromoSource.GROOVER,
                campaign_id=campaign.id if campaign else None,
                campaign_url=row.track_link,
                influencer_name=row.influencer_name,
                influencer_type=row.influencer_type,
                decision=row.decision,
                sharing_link=row.sharing_link,
                feedback=row.feedback,
                submitted_at=submitted_at,
                responded_at=responded_at,
            )
            submissions.append(submission)

        # Batch insert
        db.add_all(submissions)

        # Create advance ledger entry if budget specified (only if single artist)
        if budget and campaign and artist_uuid:
            ledger_entry = AdvanceLedgerEntry(
                artist_id=artist_uuid,
                category=ExpenseCategory.GROOVER.value,
                amount=Decimal(budget),  # Positive amount (expense is an advance)
                entry_type=LedgerEntryType.ADVANCE,
                description=f"Groover campaign: {campaign_name}",
                effective_date=datetime.utcnow(),
            )
            db.add(ledger_entry)

        await db.commit()

        # Collect parse errors
        for err in parse_result.errors:
            errors.append(f"Row {err.row_number}: {err.error}")

        # Add artist not found errors
        if artists_not_found:
            errors.append(f"Artists not found in database: {', '.join(sorted(artists_not_found))}")

        return ImportGrooverResponse(
            created_count=len(submissions),
            matched_songs=matched_songs,
            unmatched_songs=unmatched_songs,
            campaign_id=campaign.id if campaign else None,
            errors=errors,
        )

    except HTTPException:
        # Re-raise HTTPExceptions (already formatted)
        raise
    except Exception as e:
        # Log the full exception for debugging
        import traceback
        print(f"Error in import_groover_csv: {str(e)}")
        print(traceback.format_exc())

        # Rollback transaction
        await db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error during import: {str(e)}",
        )


@router.get("/submissions", response_model=PromoSubmissionsListResponse)
async def list_promo_submissions(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    artist_id: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> PromoSubmissionsListResponse:
    """
    List all promo submissions (admin view).
    Supports filtering by artist_id and source.
    """
    from app.models.artist import Artist
    from app.models.artwork import ReleaseArtwork
    from sqlalchemy.orm import selectinload

    # Build query with joins
    query = select(PromoSubmission).options(
        selectinload(PromoSubmission.artist),
        selectinload(PromoSubmission.release_artwork)
    ).order_by(PromoSubmission.submitted_at.desc())

    if artist_id:
        try:
            artist_uuid = UUID(artist_id)
            query = query.where(PromoSubmission.artist_id == artist_uuid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid artist_id format",
            )

    if source:
        try:
            promo_source = PromoSource(source.lower())
            query = query.where(PromoSubmission.source == promo_source)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid source: {source}",
            )

    # Get total count
    count_query = select(func.count()).select_from(PromoSubmission)
    if artist_id:
        count_query = count_query.where(PromoSubmission.artist_id == artist_uuid)
    if source:
        count_query = count_query.where(PromoSubmission.source == promo_source)

    total_result = await db.execute(count_query)
    total_count = total_result.scalar()

    # Get paginated results
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    submissions = result.scalars().all()

    # Build response with artist_name and release_title
    submission_responses = []
    for s in submissions:
        response_data = PromoSubmissionResponse.model_validate(s).model_dump()
        response_data['artist_name'] = s.artist.name if s.artist else None
        response_data['release_title'] = s.release_artwork.name if s.release_artwork else None
        submission_responses.append(PromoSubmissionResponse(**response_data))

    return PromoSubmissionsListResponse(
        submissions=submission_responses,
        total_count=total_count,
        page=offset // limit + 1,
        page_size=limit,
    )


@router.get("/tracks-summary", response_model=TracksSummaryResponse)
async def get_tracks_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    artist_id: Optional[str] = None,
    release_upc: Optional[str] = None,
) -> TracksSummaryResponse:
    """
    Get summary of promo submissions grouped by track.
    Shows metrics per track (listened, approved, declined, shared, playlists).
    """
    from app.models.artist import Artist
    from app.models.artwork import ReleaseArtwork
    from sqlalchemy.orm import selectinload
    from collections import defaultdict

    # Build query
    query = select(PromoSubmission).options(
        selectinload(PromoSubmission.artist),
        selectinload(PromoSubmission.release_artwork)
    )

    if artist_id:
        try:
            artist_uuid = UUID(artist_id)
            query = query.where(PromoSubmission.artist_id == artist_uuid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid artist_id format",
            )

    if release_upc:
        query = query.where(PromoSubmission.release_upc == release_upc)

    result = await db.execute(query)
    submissions = result.scalars().all()

    # Group by track (song_title + release_upc + artist_id)
    tracks_data = defaultdict(lambda: {
        'submissions': [],
        'listened': 0,
        'approved': 0,
        'declined': 0,
        'shared': 0,
        'playlists': 0,
        'sources': set(),
        'latest_submitted_at': None,
    })

    for sub in submissions:
        # Create unique key for track
        key = (sub.song_title, sub.release_upc or 'no_release', sub.artist_id)
        track = tracks_data[key]
        track['submissions'].append(sub)
        track['sources'].add(sub.source.value if hasattr(sub.source, 'value') else str(sub.source))

        # Count actions/decisions
        action = (sub.action or '').lower()
        decision = (sub.decision or '').lower()

        if 'listen' in action:
            track['listened'] += 1
        if 'approved' in action or 'approved' in decision or 'accepted' in decision:
            track['approved'] += 1
        if 'declined' in action or 'declined' in decision or 'rejected' in decision:
            track['declined'] += 1
        if 'shared' in action or 'shar' in decision:
            track['shared'] += 1
        if 'playlist' in decision or 'added' in decision:
            track['playlists'] += 1

        # Track latest submission date
        if sub.submitted_at:
            if track['latest_submitted_at'] is None or sub.submitted_at > track['latest_submitted_at']:
                track['latest_submitted_at'] = sub.submitted_at

    # Build response
    track_summaries = []
    for (song_title, release_upc_key, artist_id), track_data in tracks_data.items():
        first_sub = track_data['submissions'][0]
        track_summaries.append(TrackSummary(
            song_title=song_title,
            artist_id=artist_id,
            artist_name=first_sub.artist.name if first_sub.artist else 'Unknown',
            release_title=first_sub.release_artwork.name if first_sub.release_artwork else None,
            release_upc=first_sub.release_upc,
            track_isrc=first_sub.track_isrc,
            total_submissions=len(track_data['submissions']),
            total_listened=track_data['listened'],
            total_approved=track_data['approved'],
            total_declined=track_data['declined'],
            total_shared=track_data['shared'],
            total_playlists=track_data['playlists'],
            sources=list(track_data['sources']),
            latest_submitted_at=track_data['latest_submitted_at'],
        ))

    # Sort by latest submission date (most recent first)
    track_summaries.sort(key=lambda x: x.latest_submitted_at or datetime.min, reverse=True)

    return TracksSummaryResponse(
        tracks=track_summaries,
        total_tracks=len(track_summaries),
    )


@router.get("/stats", response_model=PromoStatsResponse)
async def get_promo_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    artist_id: Optional[str] = None,
) -> PromoStatsResponse:
    """
    Get promo stats (admin view).
    Optionally filter by artist_id.
    """
    # Build base query
    query = select(PromoSubmission)

    if artist_id:
        try:
            artist_uuid = UUID(artist_id)
            query = query.where(PromoSubmission.artist_id == artist_uuid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid artist_id format",
            )

    result = await db.execute(query)
    submissions = result.scalars().all()

    # Calculate stats
    total_submissions = len(submissions)
    by_source = {}
    by_action = {}
    by_decision = {}
    total_listens = 0
    total_approvals = 0
    total_playlists = 0

    for sub in submissions:
        # By source
        source_key = sub.source.value if hasattr(sub.source, 'value') else str(sub.source)
        by_source[source_key] = by_source.get(source_key, 0) + 1

        # By action (SubmitHub)
        if sub.action:
            by_action[sub.action] = by_action.get(sub.action, 0) + 1
            if sub.action == "listen":
                total_listens += 1
            elif sub.action == "approved":
                total_approvals += 1

        # By decision (Groover)
        if sub.decision:
            by_decision[sub.decision] = by_decision.get(sub.decision, 0) + 1
            if "playlist" in sub.decision.lower():
                total_playlists += 1

    return PromoStatsResponse(
        total_submissions=total_submissions,
        by_source=by_source,
        by_action=by_action,
        by_decision=by_decision,
        total_listens=total_listens,
        total_approvals=total_approvals,
        total_playlists=total_playlists,
    )


@router.get("/stats/detailed", response_model=DetailedPromoStatsResponse)
async def get_detailed_promo_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> DetailedPromoStatsResponse:
    """
    Get detailed promo stats with breakdowns by artist and album.
    """
    from app.models.artist import Artist
    from app.models.artwork import ReleaseArtwork
    from sqlalchemy.orm import selectinload

    # Load all submissions with related data
    result = await db.execute(
        select(PromoSubmission)
        .options(
            selectinload(PromoSubmission.artist),
            selectinload(PromoSubmission.release_artwork)
        )
    )
    submissions = result.scalars().all()

    # Calculate global stats
    total_submissions = len(submissions)
    by_source = {}
    by_action = {}
    by_decision = {}
    total_listens = 0
    total_approvals = 0
    total_playlists = 0

    # Group by artist
    artist_stats = {}
    # Group by album
    album_stats = {}

    for sub in submissions:
        # Global stats
        source_key = sub.source.value if hasattr(sub.source, 'value') else str(sub.source)
        by_source[source_key] = by_source.get(source_key, 0) + 1

        if sub.action:
            by_action[sub.action] = by_action.get(sub.action, 0) + 1
            if sub.action == "listen":
                total_listens += 1
            elif sub.action == "approved":
                total_approvals += 1

        if sub.decision:
            by_decision[sub.decision] = by_decision.get(sub.decision, 0) + 1
            if "playlist" in sub.decision.lower():
                total_playlists += 1

        # By artist
        artist_id = sub.artist_id
        if artist_id not in artist_stats:
            artist_stats[artist_id] = {
                'artist_name': sub.artist.name if sub.artist else 'Unknown',
                'total_submissions': 0,
                'total_listened': 0,
                'total_approved': 0,
                'total_declined': 0,
                'total_shared': 0,
                'total_playlists': 0,
            }

        artist_stats[artist_id]['total_submissions'] += 1

        if sub.action:
            if sub.action == "listen":
                artist_stats[artist_id]['total_listened'] += 1
            elif sub.action == "approved":
                artist_stats[artist_id]['total_approved'] += 1
            elif sub.action == "declined":
                artist_stats[artist_id]['total_declined'] += 1
            elif sub.action == "shared":
                artist_stats[artist_id]['total_shared'] += 1

        if sub.decision:
            if "playlist" in sub.decision.lower() or "added" in sub.decision.lower():
                artist_stats[artist_id]['total_playlists'] += 1
            elif "approved" in sub.decision.lower() or "accepted" in sub.decision.lower():
                artist_stats[artist_id]['total_approved'] += 1
            elif "declined" in sub.decision.lower() or "rejected" in sub.decision.lower():
                artist_stats[artist_id]['total_declined'] += 1

        # By album
        if sub.release_artwork:
            album_key = sub.release_upc or sub.release_artwork.upc
            if album_key and album_key not in album_stats:
                album_stats[album_key] = {
                    'release_upc': album_key,
                    'release_title': sub.release_artwork.name or 'Unknown Album',
                    'artist_id': artist_id,
                    'artist_name': sub.artist.name if sub.artist else 'Unknown',
                    'total_submissions': 0,
                    'total_listened': 0,
                    'total_approved': 0,
                    'total_declined': 0,
                    'total_shared': 0,
                    'total_playlists': 0,
                }

            if album_key:
                album_stats[album_key]['total_submissions'] += 1

                if sub.action:
                    if sub.action == "listen":
                        album_stats[album_key]['total_listened'] += 1
                    elif sub.action == "approved":
                        album_stats[album_key]['total_approved'] += 1
                    elif sub.action == "declined":
                        album_stats[album_key]['total_declined'] += 1
                    elif sub.action == "shared":
                        album_stats[album_key]['total_shared'] += 1

                if sub.decision:
                    if "playlist" in sub.decision.lower() or "added" in sub.decision.lower():
                        album_stats[album_key]['total_playlists'] += 1
                    elif "approved" in sub.decision.lower() or "accepted" in sub.decision.lower():
                        album_stats[album_key]['total_approved'] += 1
                    elif "declined" in sub.decision.lower() or "rejected" in sub.decision.lower():
                        album_stats[album_key]['total_declined'] += 1

    # Convert to response format
    by_artist = []
    for artist_id, stats in artist_stats.items():
        approval_rate = (
            (stats['total_approved'] / stats['total_submissions']) * 100
            if stats['total_submissions'] > 0
            else 0.0
        )
        by_artist.append(ArtistPromoStats(
            artist_id=artist_id,
            artist_name=stats['artist_name'],
            total_submissions=stats['total_submissions'],
            total_listened=stats['total_listened'],
            total_approved=stats['total_approved'],
            total_declined=stats['total_declined'],
            total_shared=stats['total_shared'],
            total_playlists=stats['total_playlists'],
            approval_rate=round(approval_rate, 1),
        ))

    by_album = []
    for album_upc, stats in album_stats.items():
        approval_rate = (
            (stats['total_approved'] / stats['total_submissions']) * 100
            if stats['total_submissions'] > 0
            else 0.0
        )
        by_album.append(AlbumPromoStats(
            release_upc=stats['release_upc'],
            release_title=stats['release_title'],
            artist_id=stats['artist_id'],
            artist_name=stats['artist_name'],
            total_submissions=stats['total_submissions'],
            total_listened=stats['total_listened'],
            total_approved=stats['total_approved'],
            total_declined=stats['total_declined'],
            total_shared=stats['total_shared'],
            total_playlists=stats['total_playlists'],
            approval_rate=round(approval_rate, 1),
        ))

    # Sort by total submissions descending
    by_artist.sort(key=lambda x: x.total_submissions, reverse=True)
    by_album.sort(key=lambda x: x.total_submissions, reverse=True)

    return DetailedPromoStatsResponse(
        total_submissions=total_submissions,
        by_source=by_source,
        by_action=by_action,
        by_decision=by_decision,
        total_listens=total_listens,
        total_approvals=total_approvals,
        total_playlists=total_playlists,
        by_artist=by_artist,
        by_album=by_album,
    )


@router.post("/import/submithub/batch", response_model=List[ImportSubmitHubResponse])
async def import_submithub_batch(
    files: Annotated[List[UploadFile], File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    budget: Annotated[Optional[str], Form()] = None,
) -> List[ImportSubmitHubResponse]:
    """
    Import multiple SubmitHub CSV files at once.

    Artist names are extracted from campaign URLs and matched automatically.
    Useful for importing data from multiple artists in one go.
    """
    results = []

    for file in files:
        try:
            # Extract artist and song from filename
            filename_artist, filename_song = extract_artist_song_from_filename(file.filename or "")

            # Parse CSV
            content = await file.read()
            parser = SubmitHubParser()

            try:
                parse_result = parser.parse(content)
            except Exception as e:
                results.append(ImportSubmitHubResponse(
                    created_count=0,
                    matched_songs=[],
                    unmatched_songs=[],
                    errors=[f"Failed to parse {file.filename}: {str(e)}"],
                ))
                continue

            # Override artist/song from filename for all rows
            if filename_artist and filename_song:
                for row in parse_result.rows:
                    row.artist_name = filename_artist
                    row.song_title = filename_song

            # Process rows
            submissions = []
            matched_songs = []
            unmatched_songs = []
            errors = []
            artists_not_found = set()

            for row in parse_result.rows:
                # Try to match artist by name
                row_artist_id = None
                if row.artist_name:
                    row_artist_id = await match_artist_by_name(row.artist_name, db)
                    if not row_artist_id:
                        artists_not_found.add(row.artist_name)
                        continue  # Skip this row

                if not row_artist_id:
                    errors.append(f"Row {row.row_number}: No artist specified and couldn't extract from filename")
                    continue

                # Match song to catalog
                track_isrc, release_upc = await match_song_to_catalog(row.song_title, row_artist_id, db)

                match_info = SongMatch(
                    song_title=row.song_title,
                    track_isrc=track_isrc,
                    release_upc=release_upc,
                    match_confidence="exact" if track_isrc or release_upc else "none",
                )

                if track_isrc or release_upc:
                    matched_songs.append(match_info)
                else:
                    unmatched_songs.append(row.song_title)

                # Parse dates
                submitted_at = None
                if row.sent_date:
                    try:
                        parsed_date = date.fromisoformat(row.sent_date)
                        submitted_at = datetime.combine(parsed_date, datetime.min.time())
                    except (ValueError, TypeError):
                        pass

                responded_at = None
                if row.received_date:
                    try:
                        parsed_date = date.fromisoformat(row.received_date)
                        responded_at = datetime.combine(parsed_date, datetime.min.time())
                    except (ValueError, TypeError):
                        pass

                submission = PromoSubmission(
                    artist_id=row_artist_id,
                    release_upc=release_upc,
                    track_isrc=track_isrc,
                    song_title=row.song_title,
                    source=PromoSource.SUBMITHUB,
                    campaign_url=row.campaign_url,
                    outlet_name=row.outlet_name,
                    outlet_type=row.outlet_type,
                    action=row.action,
                    listen_time=row.listen_time,
                    feedback=row.feedback,
                    submitted_at=submitted_at,
                    responded_at=responded_at,
                )
                submissions.append(submission)

            # Batch insert
            if submissions:
                db.add_all(submissions)

            # Add errors for artists not found
            if artists_not_found:
                errors.append(f"Artists not found in database: {', '.join(artists_not_found)}")

            # Collect parse errors
            for err in parse_result.errors:
                errors.append(f"Row {err.row_number}: {err.error}")

            results.append(ImportSubmitHubResponse(
                created_count=len(submissions),
                matched_songs=matched_songs,
                unmatched_songs=unmatched_songs,
                errors=errors,
            ))

        except Exception as e:
            results.append(ImportSubmitHubResponse(
                created_count=0,
                matched_songs=[],
                unmatched_songs=[],
                errors=[f"Error processing {file.filename}: {str(e)}"],
            ))

    await db.commit()
    return results


@router.delete("/submissions/{submission_id}")
async def delete_promo_submission(
    submission_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Delete a promo submission.
    """
    try:
        uuid_id = UUID(submission_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid submission_id format",
        )

    result = await db.execute(
        select(PromoSubmission).where(PromoSubmission.id == uuid_id)
    )
    submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )

    await db.delete(submission)
    await db.commit()

    return {"success": True, "deleted_id": submission_id}
