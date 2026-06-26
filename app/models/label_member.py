"""LabelMember — links an admin user (Supabase auth) to a label.

Normal case: one member row per (label, user). Regroupement (rare):
the same ``auth_user_id`` has rows on several labels. A platform admin
(``is_platform_admin``) can see/manage every label.
"""
import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, String, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LabelRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    VIEWER = "viewer"


class LabelMember(Base):
    """Membership of an admin user in a label."""

    __tablename__ = "label_members"
    __table_args__ = (
        UniqueConstraint("label_id", "auth_user_id", name="uq_label_member"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    label_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("labels.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Supabase auth.users.id (string) — the logged-in admin.
    auth_user_id: Mapped[str] = mapped_column(String(100), nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), default=LabelRole.OWNER.value, nullable=False)
    # Platform super-admin: cross-tenant access (Whales staff).
    is_platform_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False,
    )

    def __repr__(self) -> str:
        return f"<LabelMember {self.email} label={self.label_id} role={self.role}>"
