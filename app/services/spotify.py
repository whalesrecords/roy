"""
Spotify API service for fetching artist and album artwork.

Uses the Spotify Web API with client credentials flow.
https://developer.spotify.com/documentation/web-api

Includes in-memory caching to minimize API requests and avoid rate limits.
"""
from __future__ import annotations

import base64
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory cache with TTL
_cache: Dict[str, tuple[Any, datetime]] = {}
CACHE_TTL = timedelta(hours=24)  # Cache results for 24 hours


def _get_cached(key: str) -> Optional[Any]:
    """Get a cached value if it exists and hasn't expired."""
    if key in _cache:
        value, expires = _cache[key]
        if datetime.utcnow() < expires:
            logger.debug(f"Cache hit for {key}")
            return value
        else:
            del _cache[key]
    return None


def _set_cached(key: str, value: Any) -> None:
    """Cache a value with TTL."""
    _cache[key] = (value, datetime.utcnow() + CACHE_TTL)


class SpotifyService:
    """
    Service for interacting with Spotify API.

    Handles authentication and provides methods to search for
    artists, albums, and tracks to retrieve artwork URLs.
    """

    BASE_URL = "https://api.spotify.com/v1"
    AUTH_URL = "https://accounts.spotify.com/api/token"

    def __init__(self):
        self._access_token: Optional[str] = None
        self._token_expires: Optional[datetime] = None

    async def _get_access_token(self) -> str:
        """
        Get a valid access token, refreshing if necessary.

        Uses client credentials flow (no user authorization required).
        """
        # Check if we have a valid token
        if self._access_token and self._token_expires:
            if datetime.utcnow() < self._token_expires - timedelta(minutes=1):
                return self._access_token

        # Get new token
        client_id = settings.SPOTIFY_CLIENT_ID
        client_secret = settings.SPOTIFY_CLIENT_SECRET

        if not client_id or not client_secret:
            raise ValueError("Spotify credentials not configured")

        # Base64 encode credentials
        credentials = f"{client_id}:{client_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.AUTH_URL,
                headers={
                    "Authorization": f"Basic {encoded}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={"grant_type": "client_credentials"},
            )

            if response.status_code != 200:
                logger.error(f"Failed to get Spotify token: {response.text}")
                raise ValueError("Failed to authenticate with Spotify")

            data = response.json()
            self._access_token = data["access_token"]
            expires_in = data.get("expires_in", 3600)
            self._token_expires = datetime.utcnow() + timedelta(seconds=expires_in)

            return self._access_token

    async def _request(self, endpoint: str, params: dict = None) -> dict:
        """Make an authenticated request to Spotify API."""
        token = await self._get_access_token()

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}{endpoint}",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
            )

            if response.status_code == 401:
                # Token expired, refresh and retry
                self._access_token = None
                token = await self._get_access_token()
                response = await client.get(
                    f"{self.BASE_URL}{endpoint}",
                    headers={"Authorization": f"Bearer {token}"},
                    params=params,
                )

            if response.status_code != 200:
                logger.warning(f"Spotify API error: {response.status_code} - {response.text}")
                return {}

            return response.json()

    async def search_artist(self, name: str) -> Optional[dict]:
        """
        Search for an artist by name.

        Returns:
            Dict with artist info including image URL, or None if not found.
        """
        cache_key = f"artist:{name.lower()}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

        result = await self._request("/search", {
            "q": name,
            "type": "artist",
            "limit": 1,
        })

        artists = result.get("artists", {}).get("items", [])
        if not artists:
            _set_cached(cache_key, None)
            return None

        artist = artists[0]
        images = artist.get("images", [])

        data = {
            "spotify_id": artist.get("id"),
            "name": artist.get("name"),
            "image_url": images[0]["url"] if images else None,
            "image_url_small": images[-1]["url"] if images else None,
            "popularity": artist.get("popularity"),
            "genres": artist.get("genres", []),
        }
        _set_cached(cache_key, data)
        return data

    async def search_album_by_upc(self, upc: str) -> Optional[dict]:
        """
        Search for an album by UPC barcode.

        Returns:
            Dict with album info including artwork URL, or None if not found.
        """
        cache_key = f"album:upc:{upc}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

        result = await self._request("/search", {
            "q": f"upc:{upc}",
            "type": "album",
            "limit": 1,
        })

        albums = result.get("albums", {}).get("items", [])
        if not albums:
            _set_cached(cache_key, None)
            return None

        album = albums[0]
        images = album.get("images", [])

        data = {
            "spotify_id": album.get("id"),
            "name": album.get("name"),
            "image_url": images[0]["url"] if images else None,
            "image_url_small": images[-1]["url"] if images else None,
            "release_date": album.get("release_date"),
            "total_tracks": album.get("total_tracks"),
            "artists": [a.get("name") for a in album.get("artists", [])],
        }
        _set_cached(cache_key, data)
        return data

    async def search_track_by_isrc(self, isrc: str) -> Optional[dict]:
        """
        Search for a track by ISRC code.

        Returns:
            Dict with track and album info including artwork URL, or None if not found.
        """
        cache_key = f"track:isrc:{isrc}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

        result = await self._request("/search", {
            "q": f"isrc:{isrc}",
            "type": "track",
            "limit": 1,
        })

        tracks = result.get("tracks", {}).get("items", [])
        if not tracks:
            _set_cached(cache_key, None)
            return None

        track = tracks[0]
        album = track.get("album", {})
        images = album.get("images", [])
        album_id = album.get("id")

        # Fetch full album details to get release_date and UPC
        album_release_date = None
        album_upc = None
        if album_id:
            try:
                album_details = await self._request(f"/albums/{album_id}")
                if album_details:
                    album_release_date = album_details.get("release_date")
                    external_ids = album_details.get("external_ids", {})
                    album_upc = external_ids.get("upc")
            except Exception:
                pass  # Ignore errors, we'll just have null values

        data = {
            "spotify_id": track.get("id"),
            "name": track.get("name"),
            "album_name": album.get("name"),
            "album_id": album_id,
            "album_release_date": album_release_date,
            "album_upc": album_upc,
            "image_url": images[0]["url"] if images else None,
            "image_url_small": images[-1]["url"] if images else None,
            "artists": [a.get("name") for a in track.get("artists", [])],
            "duration_ms": track.get("duration_ms"),
            "popularity": track.get("popularity"),
        }
        _set_cached(cache_key, data)
        return data

    async def get_artist(self, spotify_id: str) -> Optional[dict]:
        """Get artist info by Spotify ID."""
        result = await self._request(f"/artists/{spotify_id}")
        if not result:
            return None

        images = result.get("images", [])
        return {
            "spotify_id": result.get("id"),
            "name": result.get("name"),
            "image_url": images[0]["url"] if images else None,
            "image_url_small": images[-1]["url"] if images else None,
            "popularity": result.get("popularity"),
            "genres": result.get("genres", []),
        }

    async def get_album(self, spotify_id: str) -> Optional[dict]:
        """Get album info by Spotify ID."""
        result = await self._request(f"/albums/{spotify_id}")
        if not result:
            return None

        images = result.get("images", [])
        return {
            "spotify_id": result.get("id"),
            "name": result.get("name"),
            "image_url": images[0]["url"] if images else None,
            "image_url_small": images[-1]["url"] if images else None,
            "release_date": result.get("release_date"),
            "total_tracks": result.get("total_tracks"),
            "artists": [a.get("name") for a in result.get("artists", [])],
        }

    async def get_album_tracks(self, album_id: str) -> list[dict]:
        """
        Get all tracks for an album by Spotify ID.

        Returns:
            List of track dicts with duration, ISRC, etc.
        """
        cache_key = f"album_tracks:{album_id}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

        # First get the album to get release date and genre
        album_result = await self._request(f"/albums/{album_id}")
        album_release_date = album_result.get("release_date", "")
        album_genres = album_result.get("genres", [])
        album_label = album_result.get("label", "")

        all_tracks = []
        offset = 0
        limit = 50

        while True:
            result = await self._request(f"/albums/{album_id}/tracks", {
                "limit": limit,
                "offset": offset,
            })

            items = result.get("items", [])
            if not items:
                break

            for track in items:
                all_tracks.append({
                    "spotify_id": track.get("id"),
                    "name": track.get("name"),
                    "track_number": track.get("track_number"),
                    "disc_number": track.get("disc_number"),
                    "duration_ms": track.get("duration_ms"),
                    "explicit": track.get("explicit"),
                    "artists": [a.get("name") for a in track.get("artists", [])],
                    "isrc": track.get("external_ids", {}).get("isrc"),  # May not be available in simplified track
                })

            if len(items) < limit:
                break
            offset += limit

        # Get full track details for ISRCs (simplified tracks don't have external_ids)
        track_ids = [t["spotify_id"] for t in all_tracks if t["spotify_id"]]
        if track_ids:
            # Spotify allows max 50 tracks per request
            for i in range(0, len(track_ids), 50):
                batch = track_ids[i:i+50]
                tracks_result = await self._request("/tracks", {"ids": ",".join(batch)})
                for full_track in tracks_result.get("tracks", []):
                    if full_track:
                        for t in all_tracks:
                            if t["spotify_id"] == full_track.get("id"):
                                t["isrc"] = full_track.get("external_ids", {}).get("isrc")
                                break

        result_data = {
            "tracks": all_tracks,
            "release_date": album_release_date,
            "genres": album_genres,
            "label": album_label,
        }
        _set_cached(cache_key, result_data)
        return result_data

    async def get_artist_albums(self, artist_id: str, include_groups: str = "album,single,compilation") -> list[dict]:
        """
        Get all albums for an artist by Spotify ID.

        Args:
            artist_id: Spotify artist ID
            include_groups: Comma-separated list of album types (album, single, compilation, appears_on)

        Returns:
            List of album dicts with info including artwork URLs
        """
        cache_key = f"artist_albums:{artist_id}:{include_groups}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

        all_albums = []
        offset = 0
        limit = 50  # Max allowed by Spotify API

        while True:
            result = await self._request(f"/artists/{artist_id}/albums", {
                "include_groups": include_groups,
                "limit": limit,
                "offset": offset,
                "market": "FR",  # Use French market for availability
            })

            items = result.get("items", [])
            if not items:
                break

            for album in items:
                images = album.get("images", [])
                all_albums.append({
                    "spotify_id": album.get("id"),
                    "name": album.get("name"),
                    "album_type": album.get("album_type"),
                    "release_date": album.get("release_date"),
                    "total_tracks": album.get("total_tracks"),
                    "image_url": images[0]["url"] if images else None,
                    "image_url_small": images[-1]["url"] if images else None,
                    "artists": [a.get("name") for a in album.get("artists", [])],
                    "external_urls": album.get("external_urls", {}),
                })

            # Check if there are more albums
            if len(items) < limit:
                break
            offset += limit

        _set_cached(cache_key, all_albums)
        return all_albums


# Default service instance
spotify_service = SpotifyService()
