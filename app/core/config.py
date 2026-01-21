import os
from functools import lru_cache
from dotenv import load_dotenv

# Load .env file
load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:bje.GUE6gpy5kfp5ywf@db.huolkgcnizwrhzyboemd.supabase.co:5432/postgres"
    )
    ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "dev-admin-token")

    # Spotify API credentials (get from https://developer.spotify.com/dashboard)
    SPOTIFY_CLIENT_ID: str = os.getenv("SPOTIFY_CLIENT_ID", "")
    SPOTIFY_CLIENT_SECRET: str = os.getenv("SPOTIFY_CLIENT_SECRET", "")

    # Supabase (for auth)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://huolkgcnizwrhzyboemd.supabase.co")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

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
