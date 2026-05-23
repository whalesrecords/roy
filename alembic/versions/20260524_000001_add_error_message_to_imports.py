"""add error_message to imports

Revision ID: 20260524_000001
Revises: 20260331_000002
Create Date: 2026-05-24 00:00:01.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260524_000001'
down_revision = '20260331_000002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('imports', sa.Column('error_message', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('imports', 'error_message')
