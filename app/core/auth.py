"""
Shared authentication dependencies for FastAPI routers.
"""

from typing import Annotated

from fastapi import Header, HTTPException

from app.core.config import settings


async def verify_admin_token(x_admin_token: Annotated[str, Header()]) -> str:
    """Verify the admin token from X-Admin-Token header."""
    if not settings.ADMIN_TOKEN:
        raise HTTPException(status_code=500, detail="Admin token not configured")
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    return x_admin_token
