"""Fix bandcamp enum case - add BANDCAMP uppercase

Revision ID: 20251229_000009
Revises: 20251229_000008
Create Date: 2024-12-29

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '20251229_000009'
down_revision = '20251229_000008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'BANDCAMP' value (uppercase) to match SQLAlchemy enum behavior
    op.execute("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'BANDCAMP'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values easily
    pass
