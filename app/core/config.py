import os
from functools import lru_cache

from dotenv import load_dotenv

# Load .env file
load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""

    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "")

    # Admin email allowlist (comma-separated). Used by the native admin app:
    # a Supabase JWT only grants admin access if its user email is listed here.
    # Artists also have Supabase accounts, so the allowlist is what separates
    # admins from artists — a valid JWT alone is never enough.
    ADMIN_EMAILS: str = os.getenv(
        "ADMIN_EMAILS", "hello@whalesrecords.com,royalties@whalesrecords.com"
    )

    # Spotify API credentials (get from https://developer.spotify.com/dashboard)
    SPOTIFY_CLIENT_ID: str = os.getenv("SPOTIFY_CLIENT_ID", "")
    SPOTIFY_CLIENT_SECRET: str = os.getenv("SPOTIFY_CLIENT_SECRET", "")

    # Supabase (for auth)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

    @property
    def admin_emails(self) -> set[str]:
        """Lower-cased set of allowlisted admin emails."""
        return {e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()}

    # Sync URL for migrations (if needed)
    @property
    def DATABASE_URL_SYNC(self) -> str:
        url = self.DATABASE_URL
        if "+aiosqlite" in url:
            return url.replace("+aiosqlite", "")
        return url.replace("+asyncpg", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
