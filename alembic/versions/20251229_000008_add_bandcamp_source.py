"""Add bandcamp to import source enum

Revision ID: 20251229_000008
Revises: 20251229_000007
Create Date: 2024-12-29

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '20251229_000008'
down_revision = '20251229_000007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'bandcamp' value to the importsource enum
    op.execute("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'bandcamp'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values easily
    pass
