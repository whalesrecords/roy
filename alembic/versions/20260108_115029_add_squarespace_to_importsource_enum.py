"""Add squarespace to ImportSource enum

Revision ID: 8f0fb94b0709
Revises: 20251229_000010
Create Date: 2026-01-08 11:50:29.646800

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8f0fb94b0709'
down_revision: Union[str, None] = '20251229_000010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'squarespace' value to the importsource enum
    op.execute("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'squarespace'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values easily
    pass
