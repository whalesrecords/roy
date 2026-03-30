"""Add uppercase enum values for detailsdetails and believe sources

Revision ID: d4e5f6a7b809
Revises: c3d4e5f6a708
Create Date: 2026-03-30 16:00:00.000000

SQLAlchemy sends enum member names in UPPERCASE to PostgreSQL.
The previous migration only added lowercase values.

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'd4e5f6a7b809'
down_revision: Union[str, None] = 'c3d4e5f6a708'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'DETAILSDETAILS'")
    op.execute("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'BELIEVE_UK'")
    op.execute("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'BELIEVE_FR'")
    op.execute("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'CDBABY'")
    op.execute("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'SUBMITHUB'")
    op.execute("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'GROOVER'")
    op.execute("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'OTHER'")


def downgrade() -> None:
    pass
