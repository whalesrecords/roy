"""Fix payment enum case - add PAYMENT uppercase

Revision ID: 20251229_000006
Revises: 20251229_000005
Create Date: 2024-12-29

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '20251229_000006'
down_revision = '20251229_000005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'PAYMENT' value (uppercase) to match existing enum values
    op.execute("ALTER TYPE ledgerentrytype ADD VALUE IF NOT EXISTS 'PAYMENT'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values easily
    pass
