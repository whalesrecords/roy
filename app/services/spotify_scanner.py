"""
Spotify Scanner Service

Scans Spotify weekly for new releases from artists in the catalog.
Detects tracks where the album label matches the configured label name
and creates SpotifyTrackSuggestion records for admin review.
"""
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.artist import Artist
from app.models.label_settings import LabelSettings
from app.models.notification import Notification, NotificationType
from app.models.spotify_track_suggestion import SpotifyTrackSuggestion, SuggestionStatus
from app.services.spotify import spotify_service

logger = logging.getLogger(__name__)

# How far back to look for new releases (8 days for safety margin)
SCAN_LOOKBACK_DAYS = 8


async def refresh_artist_photos(db: AsyncSession) -> dict:
    """
    Refresh Spotify profile photos for all artists that have a spotify_id.

    Fetches the current artist data from Spotify and updates image_url /
    image_url_small in the Artist record if they have changed.

    Returns a summary dict: {updated, skipped, errors}.
    """
    summary = {"updated": 0, "skipped": 0, "errors": []}

    artists_result = await db.execute(
        select(Artist).where(Artist.spotify_id.isnot(None))
    )
    artists = artists_result.scalars().all()

    for artist in artists:
        try:
            data = await spotify_service.get_artist(artist.spotify_id)
            if not data:
                summary["skipped"] += 1
                continue

            new_image = data.get("image_url")
            new_image_small = data.get("image_url_small")

            if new_image and (new_image != artist.image_url or new_image_small != artist.image_url_small):
                artist.image_url = new_image
                artist.image_url_small = new_image_small
                summary["updated"] += 1
                logger.info(f"Updated photo for {artist.name}")
            else:
                summary["skipped"] += 1

        except Exception as e:
            msg = f"Error refreshing photo for {artist.name}: {e}"
            logger.error(msg)
            summary["errors"].append(msg)

    await db.commit()
    logger.info(
        f"Photo refresh: {summary['updated']} updated, "
        f"{summary['skipped']} unchanged, {len(summary['errors'])} errors"
    )
    return summary


def _parse_release_date(date_str: str) -> Optional[date]:
    """Parse Spotify release date string (YYYY-MM-DD or YYYY-MM or YYYY)."""
    if not date_str:
        return None
    try:
        if len(date_str) == 10:
            return date.fromisoformat(date_str)
        if len(date_str) == 7:
            return date.fromisoformat(date_str + "-01")
        if len(date_str) == 4:
            return date.fromisoformat(date_str + "-01-01")
    except ValueError:
        pass
    return None


def _label_matches(spotify_label: Optional[str], configured_label: str) -> bool:
    """Return True if the Spotify label string contains the configured label name."""
    if not spotify_label or not configured_label:
        return False
    return configured_label.strip().lower() in spotify_label.strip().lower()


async def scan_new_releases(db: AsyncSession) -> dict:
    """
    Scan Spotify for new releases from all artists with a spotify_id.

    For each release found in the last SCAN_LOOKBACK_DAYS days whose label
    matches the configured label name, creates a SpotifyTrackSuggestion if
    not already present.

    Returns a summary dict: {scanned_artists, new_suggestions, errors}.
    """
    since = date.today() - timedelta(days=SCAN_LOOKBACK_DAYS)
    summary = {"scanned_artists": 0, "new_suggestions": 0, "errors": []}

    # 1. Get configured label name
    label_result = await db.execute(select(LabelSettings).limit(1))
    label_settings = label_result.scalar_one_or_none()
    label_name = label_settings.label_name if label_settings else "Whales Records"

    # 2. Get all artists that have a Spotify ID
    artists_result = await db.execute(
        select(Artist).where(Artist.spotify_id.isnot(None))
    )
    artists = artists_result.scalars().all()

    if not artists:
        logger.info("Spotify scanner: no artists with spotify_id found, skipping.")
        return summary

    logger.info(
        f"Spotify scanner: scanning {len(artists)} artists for releases since {since} "
        f'(label filter: "{label_name}")'
    )

    for artist in artists:
        try:
            summary["scanned_artists"] += 1
            albums = await spotify_service.get_artist_albums(
                artist.spotify_id, include_groups="album,single"
            )

            recent_albums = [
                a for a in albums
                if _parse_release_date(a.get("release_date", "")) is not None
                and _parse_release_date(a["release_date"]) >= since
            ]

            if not recent_albums:
                continue

            logger.info(
                f"Artist {artist.name}: {len(recent_albums)} recent album(s) to check"
            )

            for album in recent_albums:
                album_id = album.get("spotify_id")
                if not album_id:
                    continue

                try:
                    # get_album_tracks returns {tracks, release_date, genres, label}
                    album_data = await spotify_service.get_album_tracks(album_id)
                    spotify_label = album_data.get("label", "")

                    if not _label_matches(spotify_label, label_name):
                        logger.debug(
                            f'Album "{album["name"]}" label "{spotify_label}" '
                            f'does not match "{label_name}", skipping'
                        )
                        continue

                    logger.info(
                        f'Album "{album["name"]}" by {artist.name} matches label '
                        f'"{spotify_label}" — checking {len(album_data["tracks"])} track(s)'
                    )

                    release_date = _parse_release_date(
                        album_data.get("release_date") or album.get("release_date", "")
                    )

                    for track in album_data.get("tracks", []):
                        spotify_track_id = track.get("spotify_id")
                        if not spotify_track_id:
                            continue

                        # Check if suggestion already exists
                        existing = await db.execute(
                            select(SpotifyTrackSuggestion).where(
                                SpotifyTrackSuggestion.spotify_track_id == spotify_track_id
                            )
                        )
                        if existing.scalar_one_or_none() is not None:
                            continue  # Already suggested (any status)

                        suggestion = SpotifyTrackSuggestion(
                            artist_id=artist.id,
                            spotify_track_id=spotify_track_id,
                            spotify_album_id=album_id,
                            track_name=track.get("name", ""),
                            album_name=album.get("name", ""),
                            album_type=album.get("album_type"),
                            label_name=spotify_label,
                            release_date=release_date,
                            isrc=track.get("isrc"),
                            upc=None,  # UPC available via album search by UPC if needed
                            duration_ms=track.get("duration_ms"),
                            image_url=album.get("image_url"),
                            spotify_url=f"https://open.spotify.com/track/{spotify_track_id}",
                            track_number=track.get("track_number"),
                            status=SuggestionStatus.PENDING,
                        )
                        db.add(suggestion)
                        summary["new_suggestions"] += 1

                except Exception as e:
                    msg = f"Error processing album {album_id}: {e}"
                    logger.error(msg)
                    summary["errors"].append(msg)

        except Exception as e:
            msg = f"Error scanning artist {artist.name}: {e}"
            logger.error(msg)
            summary["errors"].append(msg)

    await db.commit()

    # 3. Create a notification if we found new suggestions
    if summary["new_suggestions"] > 0:
        notif = Notification(
            notification_type=NotificationType.SPOTIFY_SUGGESTIONS,
            title="Nouvelles sorties Spotify détectées",
            message=(
                f"{summary['new_suggestions']} nouvelle(s) piste(s) de votre label "
                f"trouvée(s) sur Spotify. Rendez-vous dans Catalogue → Suggestions."
            ),
            is_read=False,
        )
        db.add(notif)
        await db.commit()

    logger.info(
        f"Spotify scanner finished: {summary['scanned_artists']} artists scanned, "
        f"{summary['new_suggestions']} new suggestions, {len(summary['errors'])} errors"
    )
    return summary
