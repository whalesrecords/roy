"""Labels (multi-tenant) — read endpoints for the label selector.

Lot 1 of the multi-tenant rollout: exposes the labels an admin may
access. Per-table data isolation (label_id scoping) and self-service
signup come in later lots.
"""
import re
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_admin_email, get_supabase_user
from app.core.database import get_db
from app.models.artist import Artist
from app.models.artist_label import ArtistLabel
from app.models.label import Label, LabelStatus
from app.models.label_distributor import LabelDistributor
from app.models.label_member import LabelMember, LabelRole
from app.schemas.label import LabelOut, LabelSignupRequest, LabelSignupResponse

_RESERVED_SLUGS = {"admin", "api", "platform", "app", "www", "public", "signup"}


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower().strip()).strip("-")
    return s or "label"

router = APIRouter(prefix="/labels", tags=["labels"])


@router.post("/signup", response_model=LabelSignupResponse, status_code=status.HTTP_201_CREATED)
async def signup_label(
    payload: LabelSignupRequest,
    user: dict = Depends(get_supabase_user),
    db: AsyncSession = Depends(get_db),
):
    """Self-service label registration.

    The signing-up user (any authenticated Supabase account) becomes the label
    OWNER. The label is created with status ``pending`` and must be activated by
    a platform admin (moderation). Selected artists are created and linked to the
    new label; declared distributors/tools are recorded.
    """
    name = (payload.label_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Le nom du label est requis.")

    # Generate a unique, non-reserved slug.
    base = _slugify(name)
    if base in _RESERVED_SLUGS:
        base = f"{base}-label"
    slug, i = base, 2
    while (await db.execute(select(Label.id).where(Label.slug == slug))).scalar() is not None:
        slug, i = f"{base}-{i}", i + 1

    label = Label(
        slug=slug,
        name=name,
        country=payload.country,
        accent_color=(payload.accent_color or "#EF7E2E"),
        logo_base64=payload.logo_base64,
        status=LabelStatus.PENDING.value,
        plan="free",
    )
    db.add(label)
    await db.flush()  # populate label.id

    # The signing-up user owns the label (not a platform admin).
    db.add(LabelMember(
        label_id=label.id,
        auth_user_id=user["id"],
        email=user["email"],
        role=LabelRole.OWNER.value,
        is_platform_admin=False,
    ))

    # Create + link selected artists (shared entity, scoped via artist_labels).
    for a in payload.artists:
        nm = (a.name or "").strip()
        if not nm:
            continue
        artist = Artist(name=nm, spotify_id=(a.spotify_id or None), image_url=(a.image_url or None))
        db.add(artist)
        await db.flush()
        db.add(ArtistLabel(label_id=label.id, artist_id=artist.id))

    # Record declared distributors / tools.
    for d in payload.distributors:
        nm = (d.name or "").strip()
        if not nm:
            continue
        db.add(LabelDistributor(
            label_id=label.id, kind=d.kind, name=nm,
            account_ref=d.account_ref, notes=d.notes,
        ))

    await db.commit()
    return LabelSignupResponse(label_id=label.id, slug=label.slug, status=label.status)


async def _is_platform_admin(db: AsyncSession, email: Optional[str]) -> bool:
    """A None email means the shared web token (Whales platform context)."""
    if email is None:
        return True
    rows = (
        await db.execute(
            select(LabelMember.is_platform_admin).where(
                func.lower(LabelMember.email) == email.lower()
            )
        )
    ).scalars().all()
    return any(bool(r) for r in rows)


async def _accessible_label_ids(db: AsyncSession, email: str) -> list[UUID]:
    return (
        await db.execute(
            select(LabelMember.label_id).where(
                func.lower(LabelMember.email) == email.lower()
            )
        )
    ).scalars().all()


@router.get("", response_model=list[LabelOut])
async def list_labels(
    email: Optional[str] = Depends(get_admin_email),
    db: AsyncSession = Depends(get_db),
):
    """Labels the caller may access (selector data source).

    Platform admins (web proxy token, or members flagged platform-admin)
    see every label; other admins see only the labels they belong to.
    """
    if await _is_platform_admin(db, email):
        return (await db.execute(select(Label).order_by(Label.name))).scalars().all()

    label_ids = await _accessible_label_ids(db, email)  # type: ignore[arg-type]
    if not label_ids:
        return []
    return (
        await db.execute(
            select(Label).where(Label.id.in_(label_ids)).order_by(Label.name)
        )
    ).scalars().all()


@router.get("/{label_id}", response_model=LabelOut)
async def get_label(
    label_id: UUID,
    email: Optional[str] = Depends(get_admin_email),
    db: AsyncSession = Depends(get_db),
):
    label = (
        await db.execute(select(Label).where(Label.id == label_id))
    ).scalar_one_or_none()
    if label is None:
        raise HTTPException(status_code=404, detail="Label not found")

    if await _is_platform_admin(db, email):
        return label

    label_ids = await _accessible_label_ids(db, email)  # type: ignore[arg-type]
    if label_id not in label_ids:
        # Don't reveal existence of other tenants.
        raise HTTPException(status_code=404, detail="Label not found")
    return label


@router.patch("/{label_id}/status", response_model=LabelOut)
async def set_label_status(
    label_id: UUID,
    new_status: str,
    email: Optional[str] = Depends(get_admin_email),
    db: AsyncSession = Depends(get_db),
):
    """Activate / suspend a label (moderation). Platform admins only."""
    if not await _is_platform_admin(db, email):
        raise HTTPException(status_code=403, detail="Réservé au super-admin plateforme.")
    valid = {LabelStatus.PENDING.value, LabelStatus.ACTIVE.value, LabelStatus.SUSPENDED.value}
    if new_status not in valid:
        raise HTTPException(status_code=400, detail=f"Statut invalide (attendu: {', '.join(sorted(valid))}).")
    label = (await db.execute(select(Label).where(Label.id == label_id))).scalar_one_or_none()
    if label is None:
        raise HTTPException(status_code=404, detail="Label not found")
    label.status = new_status
    await db.commit()
    await db.refresh(label)
    return label
