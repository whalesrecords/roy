"""Add physical product fields (SKU, physical_format)

Revision ID: 20251229_000010
Revises: 20251229_000009
Create Date: 2024-12-29

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20251229_000010'
down_revision = '20251229_000009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add SKU column for physical product identifiers
    op.add_column(
        'transactions_normalized',
        sa.Column('sku', sa.String(100), nullable=True)
    )
    # Add physical_format column for CD/Vinyl/etc
    op.add_column(
        'transactions_normalized',
        sa.Column('physical_format', sa.String(100), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('transactions_normalized', 'physical_format')
    op.drop_column('transactions_normalized', 'sku')
