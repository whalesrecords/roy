"""Add auth_user_id to artists table for Supabase Auth

Revision ID: 20260121_000001
Revises: 20260113_000001
Create Date: 2026-01-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260121_000001'
down_revision: Union[str, None] = '20260113_000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add auth_user_id column (links to Supabase auth.users.id)
    op.add_column('artists', sa.Column('auth_user_id', sa.String(100), nullable=True))
    op.create_index('ix_artists_auth_user_id', 'artists', ['auth_user_id'], unique=True)

    # Add unique index to email for login lookup
    try:
        op.create_index('ix_artists_email', 'artists', ['email'], unique=True)
    except Exception:
        pass  # Index might already exist


def downgrade() -> None:
    op.drop_index('ix_artists_auth_user_id', table_name='artists')
    try:
        op.drop_index('ix_artists_email', table_name='artists')
    except Exception:
        pass
    op.drop_column('artists', 'auth_user_id')
