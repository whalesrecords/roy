"""Add payment to ledger entry type enum

Revision ID: 20251229_000005
Revises: 20251229_000004
Create Date: 2024-12-29

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '20251229_000005'
down_revision = '20251229_000004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'payment' value to the ledgerentrytype enum
    op.execute("ALTER TYPE ledgerentrytype ADD VALUE IF NOT EXISTS 'payment'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values easily
    # This would require recreating the type and all columns using it
    pass
