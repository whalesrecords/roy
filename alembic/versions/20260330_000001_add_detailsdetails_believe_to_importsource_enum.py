"""Add detailsdetails and believe variants to ImportSource enum

Revision ID: c3d4e5f6a708
Revises: b2c3d4e5f607
Create Date: 2026-03-30 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a708'
down_revision: Union[str, None] = 'b2c3d4e5f607'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'detailsdetails'")
    op.execute("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'believe_uk'")
    op.execute("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'believe_fr'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values
    pass
