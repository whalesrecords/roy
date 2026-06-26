"""Register/unregister admin device push tokens."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import verify_admin_token
from app.core.database import get_db
from app.models.push_token import AdminPushToken

router = APIRouter(prefix="/push-tokens", tags=["push"])


class RegisterTokenRequest(BaseModel):
    token: str
    platform: Optional[str] = None
    email: Optional[str] = None


@router.post("")
async def register_token(
    req: RegisterTokenRequest,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """Register (or refresh) an Expo push token for the current admin device."""
    existing = await db.execute(select(AdminPushToken).where(AdminPushToken.token == req.token))
    row = existing.scalar_one_or_none()
    if row:
        row.last_seen_at = datetime.utcnow()
        if req.platform:
            row.platform = req.platform
        if req.email:
            row.email = req.email
    else:
        db.add(AdminPushToken(token=req.token, platform=req.platform, email=req.email))
    await db.commit()
    return {"success": True}


@router.delete("/{token}")
async def delete_token(
    token: str,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """Remove a push token (e.g. on logout)."""
    existing = await db.execute(select(AdminPushToken).where(AdminPushToken.token == token))
    row = existing.scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()
    return {"success": True}
