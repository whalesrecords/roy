"""Label (tenant) context for admin requests — Lot 2 Phase B.

Resolves *which label* an admin request operates on, and provides helpers to
scope queries and stamp writes. Safe-by-design rollout:

- **Platform admin** (Whales staff — shared web token, or a member flagged
  ``is_platform_admin``): no filter by default → sees everything, exactly like
  today. May narrow to one label via the ``X-Label-Id`` header.
- **Normal label admin**: always filtered to the label(s) they belong to —
  never another label's data.
- **Writes**: stamped with the selected/sole/home label (Whales for platform
  with no selection), so existing behaviour is unchanged.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional
from uuid import UUID

from fastapi import Depends, Header, HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import _admin_email_from_supabase_jwt
from app.core.config import settings
from app.core.database import get_db
from app.models.label import Label
from app.models.label_member import LabelMember


@dataclass
class LabelContext:
    email: Optional[str]                 # admin email; None = shared web token
    is_platform: bool                    # Whales super-admin → global view
    accessible_label_ids: list[UUID] = field(default_factory=list)
    current_label_id: Optional[UUID] = None   # explicit selection (X-Label-Id)
    home_label_id: Optional[UUID] = None       # label to stamp on writes

    def read_label_ids(self) -> Optional[list[UUID]]:
        """Label ids to filter reads by; ``None`` means 'no restriction'.

        A platform admin with no explicit selection reads everything; a normal
        admin is always restricted to the labels they belong to.
        """
        if self.current_label_id is not None:
            return [self.current_label_id]
        if self.is_platform:
            return None
        return self.accessible_label_ids or [UUID(int=0)]  # empty → match nothing

    def write_label_id(self) -> Optional[UUID]:
        """Label id to stamp on newly-created rows."""
        return self.current_label_id or self.home_label_id


def apply_label_scope(stmt, label_column, ctx: LabelContext):
    """Add a ``label_id`` filter to ``stmt`` unless the caller sees everything."""
    ids = ctx.read_label_ids()
    if ids is None:
        return stmt
    return stmt.where(label_column.in_(ids))


async def get_label_context(
    x_admin_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
    x_label_id: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> LabelContext:
    """Authorize an admin caller and resolve their label context.

    Authorization rules are identical to :func:`verify_admin_token`; this also
    determines the accessible labels and the current selection.
    """
    if not settings.ADMIN_TOKEN:
        raise HTTPException(status_code=500, detail="Admin token not configured")

    email: Optional[str] = None
    authorized = False

    # Path 1 — shared web token → platform context, no user identity.
    if x_admin_token and x_admin_token == settings.ADMIN_TOKEN:
        authorized = True
    # Path 2 — Supabase JWT for an allowlisted admin (native app).
    elif authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):].strip()
        em = _admin_email_from_supabase_jwt(token)
        if em and em.lower() in settings.admin_emails:
            email = em
            authorized = True

    if not authorized:
        raise HTTPException(status_code=401, detail="Invalid admin token")

    whales_id = (
        await db.execute(select(Label.id).where(Label.slug == "whales-records"))
    ).scalar()

    if email is None:
        # Shared web token = Whales platform context.
        is_platform = True
        accessible = list((await db.execute(select(Label.id))).scalars().all())
        home = whales_id
    else:
        members = (
            await db.execute(
                select(LabelMember).where(func.lower(LabelMember.email) == email.lower())
            )
        ).scalars().all()
        is_platform = any(m.is_platform_admin for m in members)
        if is_platform:
            accessible = list((await db.execute(select(Label.id))).scalars().all())
            home = whales_id
        else:
            accessible = [m.label_id for m in members]
            home = accessible[0] if accessible else None

    current: Optional[UUID] = None
    if x_label_id:
        try:
            selected = UUID(x_label_id)
        except ValueError:
            selected = None
        if selected and (is_platform or selected in accessible):
            current = selected
    if current is None and not is_platform and len(accessible) == 1:
        current = accessible[0]

    # Transmit the current label to Postgres (RLS, defense in depth). Empty
    # string = "no restriction" → the platform/global view sees everything.
    # Transaction-scoped (set_config local) so it never leaks across requests.
    await db.execute(
        text("SELECT set_config('app.current_label_id', :v, true)"),
        {"v": str(current) if current else ""},
    )

    return LabelContext(
        email=email,
        is_platform=is_platform,
        accessible_label_ids=list(accessible),
        current_label_id=current,
        home_label_id=current or home,
    )
