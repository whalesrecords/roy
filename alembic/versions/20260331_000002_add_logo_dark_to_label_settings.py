"""add logo_dark_base64 to label_settings

Revision ID: 20260331_000002
Revises: 20260331_000001
Create Date: 2026-03-31

"""
from alembic import op
import sqlalchemy as sa

revision = '20260331_000002'
down_revision = '20260331_000001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('label_settings', sa.Column('logo_dark_base64', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('label_settings', 'logo_dark_base64')
