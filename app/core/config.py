import os
from functools import lru_cache


class Settings:
    """Application settings loaded from environment variables."""

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:bje.GUE6gpy5kfp5ywf@db.huolkgcnizwrhzyboemd.supabase.co:5432/postgres"
    )
    ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "dev-admin-token")

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
