"""Supabase client for authentication operations."""
from app.core.config import settings


def get_supabase_admin_client():
    """
    Get Supabase client with service role key for admin operations.

    This client can:
    - Create users
    - Delete users
    - Update user metadata
    - Bypass Row Level Security
    """
    from supabase import create_client

    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY not configured")

    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY
    )


def get_supabase_client():
    """
    Get Supabase client with anon key for public operations.
    """
    from supabase import create_client

    if not settings.SUPABASE_ANON_KEY:
        raise ValueError("SUPABASE_ANON_KEY not configured")

    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY
    )
