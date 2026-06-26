"""Send push notifications to admin devices via the Expo Push API.

Best-effort: failures are logged and never propagate to the caller, so a push
problem can never break the API request that triggered it.
"""
import logging
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.push_token import AdminPushToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_admin_push(
    db: AsyncSession,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> None:
    """Send a push notification to every registered admin device."""
    try:
        result = await db.execute(select(AdminPushToken.token))
        tokens = [t for (t,) in result.all() if t]
        if not tokens:
            return

        messages = [
            {"to": t, "title": title, "body": body, "sound": "default", "data": data or {}}
            for t in tokens
        ]
        async with httpx.AsyncClient(timeout=10) as client:
            # Expo accepts batches; chunk at 100 messages per request.
            for i in range(0, len(messages), 100):
                await client.post(
                    EXPO_PUSH_URL,
                    json=messages[i : i + 100],
                    headers={"Content-Type": "application/json", "Accept": "application/json"},
                )
    except Exception as e:  # noqa: BLE001 — push is best-effort
        logger.warning(f"send_admin_push failed: {e}")
