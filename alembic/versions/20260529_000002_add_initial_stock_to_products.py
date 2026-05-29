"""add initial_stock_quantity to products

Revision ID: 20260529_000002
Revises: 20260529_000001
Create Date: 2026-05-29 00:00:02.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '20260529_000002'
down_revision = '20260529_000001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'products',
        sa.Column('initial_stock_quantity', sa.Integer(), nullable=False, server_default='300'),
    )


def downgrade() -> None:
    op.drop_column('products', 'initial_stock_quantity')
