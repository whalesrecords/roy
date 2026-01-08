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
