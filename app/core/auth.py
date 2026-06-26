"""
Shared authentication dependencies for FastAPI routers.
"""

import logging
from typing import Optional

from fastapi import Header, HTTPException

from app.core.config import settings
from app.core.supabase_client import get_supabase_admin_client

logger = logging.getLogger(__name__)


def _admin_email_from_supabase_jwt(token: str) -> Optional[str]:
    """Validate a Supabase JWT and return the authenticated user's email.

    Returns ``None`` if Supabase is not configured or the token is invalid.
    """
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        supabase = get_supabase_admin_client()
        resp = supabase.auth.get_user(token)
        if resp and resp.user and resp.user.email:
            return resp.user.email
    except Exception as e:  # noqa: BLE001 — any failure means "not authenticated"
        logger.debug(f"Supabase admin JWT validation failed: {e}")
    return None


async def verify_admin_token(
    x_admin_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> str:
    """Authorize an admin caller.

    Two credentials are accepted:

    1. ``X-Admin-Token`` matching ``ADMIN_TOKEN`` — used by the web admin, where a
       server-side Next.js proxy injects the header (it never reaches the browser).
       This path does no network I/O.
    2. ``Authorization: Bearer <supabase-jwt>`` where the authenticated user's email
       is in the ``ADMIN_EMAILS`` allowlist — used by the native admin app, which has
       no server-side proxy. The allowlist is essential: artists also have Supabase
       accounts, so a valid JWT on its own must NOT grant admin access.
    """
    if not settings.ADMIN_TOKEN:
        raise HTTPException(status_code=500, detail="Admin token not configured")

    # Path 1 — shared admin token (web proxy). Fast path, no network call.
    if x_admin_token and x_admin_token == settings.ADMIN_TOKEN:
        return x_admin_token

    # Path 2 — Supabase JWT for an allowlisted admin (native app).
    if authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):].strip()
        email = _admin_email_from_supabase_jwt(token)
        if email and email.lower() in settings.admin_emails:
            return token

    raise HTTPException(status_code=401, detail="Invalid admin token")


async def get_admin_email(
    x_admin_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> Optional[str]:
    """Authorize an admin caller and return their email.

    Same rules as :func:`verify_admin_token`, but returns the authenticated
    email so callers can resolve which label(s) the admin may access. The
    shared ``X-Admin-Token`` (web proxy) carries no user identity, so it
    returns ``None`` — treated downstream as the platform (Whales) context.
    Raises 401 if the caller is not an authorized admin.
    """
    if not settings.ADMIN_TOKEN:
        raise HTTPException(status_code=500, detail="Admin token not configured")

    if x_admin_token and x_admin_token == settings.ADMIN_TOKEN:
        return None  # shared web token → platform context

    if authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):].strip()
        email = _admin_email_from_supabase_jwt(token)
        if email and email.lower() in settings.admin_emails:
            return email

    raise HTTPException(status_code=401, detail="Invalid admin token")
