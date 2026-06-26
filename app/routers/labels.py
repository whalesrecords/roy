"""Labels (multi-tenant) — read endpoints for the label selector.

Lot 1 of the multi-tenant rollout: exposes the labels an admin may
access. Per-table data isolation (label_id scoping) and self-service
signup come in later lots.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_admin_email
from app.core.database import get_db
from app.models.label import Label
from app.models.label_member import LabelMember
from app.schemas.label import LabelOut

router = APIRouter(prefix="/labels", tags=["labels"])


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
