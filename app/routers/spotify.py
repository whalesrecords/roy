"""
Spotify Router

Endpoints for fetching artwork from Spotify API.
"""

import logging
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.artist import Artist
from app.models.artwork import ReleaseArtwork, TrackArtwork
from app.services.spotify import spotify_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/spotify", tags=["spotify"])


async def verify_admin_token(x_admin_token: Annotated[str, Header()]) -> str:
    """Verify the admin token from header."""
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )
    return x_admin_token


class SpotifySearchResult(BaseModel):
    """Response for Spotify search."""
    spotify_id: Optional[str] = None
    name: Optional[str] = None
    image_url: Optional[str] = None
    image_url_small: Optional[str] = None
    popularity: Optional[int] = None
    genres: Optional[list[str]] = None


class SpotifyAlbumResult(BaseModel):
    """Response for Spotify album search."""
    spotify_id: Optional[str] = None
    name: Optional[str] = None
    image_url: Optional[str] = None
    image_url_small: Optional[str] = None
    release_date: Optional[str] = None
    total_tracks: Optional[int] = None
    artists: Optional[list[str]] = None


class SpotifyTrackResult(BaseModel):
    """Response for Spotify track search."""
    spotify_id: Optional[str] = None
    name: Optional[str] = None
    album_name: Optional[str] = None
    album_id: Optional[str] = None
    album_release_date: Optional[str] = None
    album_upc: Optional[str] = None
    image_url: Optional[str] = None
    image_url_small: Optional[str] = None
    artists: Optional[list[str]] = None
    duration_ms: Optional[int] = None
    popularity: Optional[int] = None


class UpdateArtworkRequest(BaseModel):
    """Request to update artist artwork."""
    image_url: Optional[str] = None
    image_url_small: Optional[str] = None
    spotify_id: Optional[str] = None


@router.get("/status")
async def spotify_status(
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """Check if Spotify API is configured."""
    configured = bool(settings.SPOTIFY_CLIENT_ID and settings.SPOTIFY_CLIENT_SECRET)
    return {
        "configured": configured,
        "message": "Spotify API is configured" if configured else "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables",
    }


@router.get("/search/artist/{name}", response_model=SpotifySearchResult)
async def search_artist(
    name: str,
    _token: Annotated[str, Depends(verify_admin_token)],
) -> SpotifySearchResult:
    """Search for an artist on Spotify by name."""
    if not settings.SPOTIFY_CLIENT_ID or not settings.SPOTIFY_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Spotify API not configured",
        )

    try:
        result = await spotify_service.search_artist(name)
        if result:
            return SpotifySearchResult(**result)
        return SpotifySearchResult()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.get("/search/album/upc/{upc}", response_model=SpotifyAlbumResult)
async def search_album_by_upc(
    upc: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> SpotifyAlbumResult:
    """Search for an album on Spotify by UPC barcode.

    First checks the database cache, then fetches from Spotify if not found.
    """
    # Check database cache first
    cached = await db.execute(select(ReleaseArtwork).where(ReleaseArtwork.upc == upc))
    cached_artwork = cached.scalar_one_or_none()

    if cached_artwork and cached_artwork.image_url:
        logger.info(f"Returning cached artwork for UPC {upc}")
        return SpotifyAlbumResult(
            spotify_id=cached_artwork.spotify_id,
            name=cached_artwork.name,
            image_url=cached_artwork.image_url,
            image_url_small=cached_artwork.image_url_small,
        )

    if not settings.SPOTIFY_CLIENT_ID or not settings.SPOTIFY_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Spotify API not configured",
        )

    try:
        result = await spotify_service.search_album_by_upc(upc)
        if result:
            # Save to database cache
            if cached_artwork:
                cached_artwork.spotify_id = result.get("spotify_id")
                cached_artwork.name = result.get("name")
                cached_artwork.image_url = result.get("image_url")
                cached_artwork.image_url_small = result.get("image_url_small")
            else:
                new_artwork = ReleaseArtwork(
                    upc=upc,
                    spotify_id=result.get("spotify_id"),
                    name=result.get("name"),
                    image_url=result.get("image_url"),
                    image_url_small=result.get("image_url_small"),
                )
                db.add(new_artwork)
            await db.flush()
            logger.info(f"Saved artwork for UPC {upc} to database")
            return SpotifyAlbumResult(**result)
        return SpotifyAlbumResult()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.get("/search/track/isrc/{isrc}", response_model=SpotifyTrackResult)
async def search_track_by_isrc(
    isrc: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> SpotifyTrackResult:
    """Search for a track on Spotify by ISRC code.

    First checks the database cache, then fetches from Spotify if not found.
    """
    # Check database cache first
    cached = await db.execute(select(TrackArtwork).where(TrackArtwork.isrc == isrc))
    cached_artwork = cached.scalar_one_or_none()

    if cached_artwork and cached_artwork.image_url:
        logger.info(f"Returning cached artwork for ISRC {isrc}")
        return SpotifyTrackResult(
            spotify_id=cached_artwork.spotify_id,
            name=cached_artwork.name,
            album_name=cached_artwork.album_name,
            image_url=cached_artwork.image_url,
            image_url_small=cached_artwork.image_url_small,
        )

    if not settings.SPOTIFY_CLIENT_ID or not settings.SPOTIFY_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Spotify API not configured",
        )

    try:
        result = await spotify_service.search_track_by_isrc(isrc)
        if result:
            # Save to database cache
            if cached_artwork:
                cached_artwork.spotify_id = result.get("spotify_id")
                cached_artwork.name = result.get("name")
                cached_artwork.album_name = result.get("album_name")
                cached_artwork.image_url = result.get("image_url")
                cached_artwork.image_url_small = result.get("image_url_small")
            else:
                new_artwork = TrackArtwork(
                    isrc=isrc,
                    spotify_id=result.get("spotify_id"),
                    name=result.get("name"),
                    album_name=result.get("album_name"),
                    image_url=result.get("image_url"),
                    image_url_small=result.get("image_url_small"),
                )
                db.add(new_artwork)
            await db.flush()
            logger.info(f"Saved artwork for ISRC {isrc} to database")
            return SpotifyTrackResult(**result)
        return SpotifyTrackResult()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.post("/artists/{artist_id}/fetch-artwork", response_model=SpotifySearchResult)
async def fetch_artist_artwork(
    artist_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> SpotifySearchResult:
    """
    Fetch artwork for an artist from Spotify and save it.

    Searches Spotify by artist name and updates the artist record.
    """
    if not settings.SPOTIFY_CLIENT_ID or not settings.SPOTIFY_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Spotify API not configured",
        )

    # Get artist
    result = await db.execute(select(Artist).where(Artist.id == artist_id))
    artist = result.scalar_one_or_none()

    if not artist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found",
        )

    try:
        spotify_result = await spotify_service.search_artist(artist.name)
        if spotify_result:
            artist.spotify_id = spotify_result.get("spotify_id")
            artist.image_url = spotify_result.get("image_url")
            artist.image_url_small = spotify_result.get("image_url_small")
            await db.flush()

            return SpotifySearchResult(**spotify_result)

        return SpotifySearchResult()

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


class SpotifyUrlRequest(BaseModel):
    """Request to fetch artist from Spotify URL."""
    spotify_url: str


def extract_spotify_id(url: str) -> Optional[str]:
    """Extract Spotify ID from a Spotify URL or return the ID if already an ID."""
    import re

    # If it's already just an ID (22 chars alphanumeric)
    if re.match(r'^[a-zA-Z0-9]{22}$', url.strip()):
        return url.strip()

    # Handle various Spotify URL formats:
    # https://open.spotify.com/artist/XXXXX
    # https://open.spotify.com/artist/XXXXX?si=...
    # spotify:artist:XXXXX
    patterns = [
        r'open\.spotify\.com/artist/([a-zA-Z0-9]+)',
        r'spotify:artist:([a-zA-Z0-9]+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    return None


@router.post("/artists/{artist_id}/fetch-from-url", response_model=SpotifySearchResult)
async def fetch_artist_from_url(
    artist_id: UUID,
    request: SpotifyUrlRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> SpotifySearchResult:
    """
    Fetch artwork for an artist using a Spotify URL.

    Accepts:
    - Full Spotify URL: https://open.spotify.com/artist/XXXXX
    - Spotify URI: spotify:artist:XXXXX
    - Just the Spotify ID: XXXXX

    This allows manually selecting the correct artist when auto-detection fails.
    """
    if not settings.SPOTIFY_CLIENT_ID or not settings.SPOTIFY_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Spotify API not configured",
        )

    # Extract Spotify ID from URL
    spotify_id = extract_spotify_id(request.spotify_url)
    if not spotify_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract Spotify ID from URL. Use format: https://open.spotify.com/artist/XXXXX",
        )

    # Get artist from database
    result = await db.execute(select(Artist).where(Artist.id == artist_id))
    artist = result.scalar_one_or_none()

    if not artist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found",
        )

    try:
        # Fetch from Spotify by ID
        spotify_result = await spotify_service.get_artist(spotify_id)
        if spotify_result:
            artist.spotify_id = spotify_result.get("spotify_id")
            artist.image_url = spotify_result.get("image_url")
            artist.image_url_small = spotify_result.get("image_url_small")
            await db.flush()

            return SpotifySearchResult(**spotify_result)

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist not found on Spotify with ID: {spotify_id}",
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.get("/artwork/releases")
async def get_cached_release_artworks(
    upcs: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> list[dict]:
    """
    Get cached artwork for multiple releases by UPC.
    Pass UPCs as comma-separated values.
    """
    upc_list = [u.strip() for u in upcs.split(",") if u.strip()]
    if not upc_list:
        return []

    result = await db.execute(
        select(ReleaseArtwork).where(ReleaseArtwork.upc.in_(upc_list))
    )
    artworks = result.scalars().all()

    return [
        {
            "upc": a.upc,
            "spotify_id": a.spotify_id,
            "name": a.name,
            "image_url": a.image_url,
            "image_url_small": a.image_url_small,
        }
        for a in artworks
    ]


@router.get("/artwork/tracks")
async def get_cached_track_artworks(
    isrcs: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> list[dict]:
    """
    Get cached artwork for multiple tracks by ISRC.
    Pass ISRCs as comma-separated values.
    """
    isrc_list = [i.strip() for i in isrcs.split(",") if i.strip()]
    if not isrc_list:
        return []

    result = await db.execute(
        select(TrackArtwork).where(TrackArtwork.isrc.in_(isrc_list))
    )
    artworks = result.scalars().all()

    return [
        {
            "isrc": a.isrc,
            "spotify_id": a.spotify_id,
            "name": a.name,
            "album_name": a.album_name,
            "image_url": a.image_url,
            "image_url_small": a.image_url_small,
        }
        for a in artworks
    ]


@router.get("/albums/{album_id}/tracks")
async def get_album_tracks(
    album_id: str,
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Get all tracks for an album from Spotify, including duration and ISRC.

    Args:
        album_id: Spotify album ID

    Returns:
        Dict with tracks list, release_date, genres, and label
    """
    if not settings.SPOTIFY_CLIENT_ID or not settings.SPOTIFY_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Spotify API not configured",
        )

    try:
        result = await spotify_service.get_album_tracks(album_id)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.get("/artists/{spotify_id}/albums")
async def get_artist_albums(
    spotify_id: str,
    _token: Annotated[str, Depends(verify_admin_token)],
    include_groups: str = "album,single,compilation",
) -> dict:
    """
    Get all albums for an artist from Spotify.

    Args:
        spotify_id: Spotify artist ID (not database artist ID)
        include_groups: Comma-separated album types (album, single, compilation, appears_on)

    Returns:
        Dict with items list containing album info
    """
    if not settings.SPOTIFY_CLIENT_ID or not settings.SPOTIFY_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Spotify API not configured",
        )

    try:
        albums = await spotify_service.get_artist_albums(spotify_id, include_groups)
        return {"items": albums, "total": len(albums)}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.put("/artists/{artist_id}/artwork")
async def update_artist_artwork(
    artist_id: UUID,
    request: UpdateArtworkRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Manually update artwork for an artist.

    Use this when Spotify auto-detection is wrong.
    """
    # Get artist
    result = await db.execute(select(Artist).where(Artist.id == artist_id))
    artist = result.scalar_one_or_none()

    if not artist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found",
        )

    if request.image_url is not None:
        artist.image_url = request.image_url
    if request.image_url_small is not None:
        artist.image_url_small = request.image_url_small
    if request.spotify_id is not None:
        artist.spotify_id = request.spotify_id

    await db.flush()

    return {
        "success": True,
        "artist_id": str(artist_id),
        "image_url": artist.image_url,
        "image_url_small": artist.image_url_small,
    }


# ============ CATALOG METADATA ENDPOINTS ============


@router.get("/catalog/releases/{upc}")
async def get_release_metadata(
    upc: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Get release metadata from database (cached Spotify data).

    Returns release info and all associated tracks with durations.
    """
    # Get release artwork with metadata
    result = await db.execute(
        select(ReleaseArtwork).where(ReleaseArtwork.upc == upc)
    )
    release = result.scalar_one_or_none()

    if not release:
        return {"found": False, "upc": upc}

    # Get all tracks for this release
    tracks_result = await db.execute(
        select(TrackArtwork).where(TrackArtwork.release_upc == upc).order_by(TrackArtwork.track_number)
    )
    tracks = tracks_result.scalars().all()

    return {
        "found": True,
        "upc": upc,
        "spotify_id": release.spotify_id,
        "name": release.name,
        "image_url": release.image_url,
        "image_url_small": release.image_url_small,
        "release_date": release.release_date,
        "genres": release.genres or [],
        "label": release.label,
        "total_tracks": release.total_tracks,
        "album_type": release.album_type,
        "tracks": [
            {
                "isrc": t.isrc,
                "spotify_id": t.spotify_id,
                "name": t.name,
                "track_number": t.track_number,
                "disc_number": t.disc_number,
                "duration_ms": t.duration_ms,
                "artists": t.artists or [],
            }
            for t in tracks
        ],
        "updated_at": release.updated_at.isoformat() if release.updated_at else None,
    }


@router.post("/catalog/releases/{upc}/refresh")
async def refresh_release_metadata(
    upc: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Refresh release metadata from Spotify API and save to database.

    This fetches fresh data from Spotify and updates the cached metadata.
    """
    if not settings.SPOTIFY_CLIENT_ID or not settings.SPOTIFY_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Spotify API not configured",
        )

    try:
        # Search for album by UPC
        album_result = await spotify_service.search_album_by_upc(upc)
        if not album_result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Album not found on Spotify for UPC: {upc}",
            )

        spotify_id = album_result.get("spotify_id")
        if not spotify_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No Spotify ID found for album",
            )

        # Get full album details including tracks
        album_details = await spotify_service.get_album_tracks(spotify_id)

        # Get or create release artwork record
        result = await db.execute(
            select(ReleaseArtwork).where(ReleaseArtwork.upc == upc)
        )
        release = result.scalar_one_or_none()

        if not release:
            release = ReleaseArtwork(upc=upc)
            db.add(release)

        # Update release metadata
        release.spotify_id = spotify_id
        release.name = album_result.get("name")
        release.image_url = album_result.get("image_url")
        release.image_url_small = album_result.get("image_url_small")
        release.release_date = album_details.get("release_date")
        release.genres = album_details.get("genres", [])
        release.label = album_details.get("label")
        release.total_tracks = album_result.get("total_tracks")
        release.album_type = album_result.get("album_type", "album")

        # Update or create track artwork records
        tracks_data = album_details.get("tracks", [])
        saved_tracks = []

        for track in tracks_data:
            isrc = track.get("isrc")
            if not isrc:
                continue

            # Get or create track artwork record
            track_result = await db.execute(
                select(TrackArtwork).where(TrackArtwork.isrc == isrc)
            )
            track_artwork = track_result.scalar_one_or_none()

            if not track_artwork:
                track_artwork = TrackArtwork(isrc=isrc)
                db.add(track_artwork)

            # Update track metadata
            track_artwork.spotify_id = track.get("spotify_id")
            track_artwork.name = track.get("name")
            track_artwork.album_name = album_result.get("name")
            track_artwork.image_url = album_result.get("image_url")
            track_artwork.image_url_small = album_result.get("image_url_small")
            track_artwork.duration_ms = track.get("duration_ms")
            track_artwork.track_number = track.get("track_number")
            track_artwork.disc_number = track.get("disc_number")
            track_artwork.artists = track.get("artists", [])
            track_artwork.release_upc = upc

            saved_tracks.append({
                "isrc": isrc,
                "name": track.get("name"),
                "track_number": track.get("track_number"),
                "duration_ms": track.get("duration_ms"),
            })

        await db.flush()

        logger.info(f"Refreshed metadata for release UPC {upc}: {len(saved_tracks)} tracks")

        return {
            "success": True,
            "upc": upc,
            "spotify_id": spotify_id,
            "name": release.name,
            "release_date": release.release_date,
            "genres": release.genres,
            "label": release.label,
            "tracks_updated": len(saved_tracks),
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.get("/catalog/tracks")
async def get_tracks_metadata(
    isrcs: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> list[dict]:
    """
    Get metadata for multiple tracks by ISRC (comma-separated).

    Returns cached track info including duration and artists.
    """
    isrc_list = [i.strip() for i in isrcs.split(",") if i.strip()]
    if not isrc_list:
        return []

    result = await db.execute(
        select(TrackArtwork).where(TrackArtwork.isrc.in_(isrc_list))
    )
    tracks = result.scalars().all()

    return [
        {
            "isrc": t.isrc,
            "spotify_id": t.spotify_id,
            "name": t.name,
            "album_name": t.album_name,
            "image_url": t.image_url,
            "image_url_small": t.image_url_small,
            "duration_ms": t.duration_ms,
            "track_number": t.track_number,
            "disc_number": t.disc_number,
            "artists": t.artists or [],
            "release_upc": t.release_upc,
        }
        for t in tracks
    ]


class BatchRefreshRequest(BaseModel):
    upcs: list[str]


@router.post("/catalog/releases/batch-refresh")
async def batch_refresh_releases(
    request: BatchRefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Refresh metadata for multiple releases from Spotify API.

    Useful for refreshing all releases for an artist at once.
    """
    upcs = request.upcs
    if not settings.SPOTIFY_CLIENT_ID or not settings.SPOTIFY_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Spotify API not configured",
        )

    results = {
        "success": [],
        "failed": [],
        "not_found": [],
    }

    for upc in upcs:
        try:
            # Search for album by UPC
            album_result = await spotify_service.search_album_by_upc(upc)
            if not album_result or not album_result.get("spotify_id"):
                results["not_found"].append(upc)
                continue

            spotify_id = album_result["spotify_id"]

            # Get full album details
            album_details = await spotify_service.get_album_tracks(spotify_id)

            # Get or create release record
            result = await db.execute(
                select(ReleaseArtwork).where(ReleaseArtwork.upc == upc)
            )
            release = result.scalar_one_or_none()

            if not release:
                release = ReleaseArtwork(upc=upc)
                db.add(release)

            # Update release
            release.spotify_id = spotify_id
            release.name = album_result.get("name")
            release.image_url = album_result.get("image_url")
            release.image_url_small = album_result.get("image_url_small")
            release.release_date = album_details.get("release_date")
            release.genres = album_details.get("genres", [])
            release.label = album_details.get("label")
            release.total_tracks = album_result.get("total_tracks")

            # Update tracks
            for track in album_details.get("tracks", []):
                isrc = track.get("isrc")
                if not isrc:
                    continue

                track_result = await db.execute(
                    select(TrackArtwork).where(TrackArtwork.isrc == isrc)
                )
                track_artwork = track_result.scalar_one_or_none()

                if not track_artwork:
                    track_artwork = TrackArtwork(isrc=isrc)
                    db.add(track_artwork)

                track_artwork.spotify_id = track.get("spotify_id")
                track_artwork.name = track.get("name")
                track_artwork.album_name = album_result.get("name")
                track_artwork.image_url = album_result.get("image_url")
                track_artwork.image_url_small = album_result.get("image_url_small")
                track_artwork.duration_ms = track.get("duration_ms")
                track_artwork.track_number = track.get("track_number")
                track_artwork.disc_number = track.get("disc_number")
                track_artwork.artists = track.get("artists", [])
                track_artwork.release_upc = upc

            results["success"].append(upc)

        except Exception as e:
            logger.error(f"Failed to refresh UPC {upc}: {e}")
            results["failed"].append({"upc": upc, "error": str(e)})

    await db.flush()

    return {
        "total": len(upcs),
        "success_count": len(results["success"]),
        "failed_count": len(results["failed"]),
        "not_found_count": len(results["not_found"]),
        "results": results,
    }


class PopulateFromCatalogRequest(BaseModel):
    """Request to populate release metadata from imports catalog."""
    upc_name_map: dict[str, str]  # {upc: release_name}


@router.post("/catalog/releases/populate-from-catalog")
async def populate_releases_from_catalog(
    request: PopulateFromCatalogRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
) -> dict:
    """
    Populate release metadata from imports catalog for releases not on Spotify.

    This allows storing release names for UPCs that are not found on Spotify,
    using data from the imports catalog (TuneCore, Bandcamp, etc.).
    """
    upc_name_map = request.upc_name_map
    results = {
        "created": [],
        "updated": [],
        "failed": [],
    }

    for upc, name in upc_name_map.items():
        try:
            # Get or create release record
            result = await db.execute(
                select(ReleaseArtwork).where(ReleaseArtwork.upc == upc)
            )
            release = result.scalar_one_or_none()

            if not release:
                release = ReleaseArtwork(upc=upc)
                db.add(release)
                results["created"].append(upc)
            else:
                results["updated"].append(upc)

            # Update release name (only if name is not already set from Spotify)
            if not release.spotify_id:
                release.name = name

        except Exception as e:
            logger.error(f"Failed to populate UPC {upc}: {e}")
            results["failed"].append({"upc": upc, "error": str(e)})

    await db.flush()

    return {
        "total": len(upc_name_map),
        "created_count": len(results["created"]),
        "updated_count": len(results["updated"]),
        "failed_count": len(results["failed"]),
        "results": results,
    }
