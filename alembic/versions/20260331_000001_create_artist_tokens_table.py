"""create artist_tokens table

Revision ID: a1b2c3d4e5f6
Revises: f6a7b8c9d011
Create Date: 2026-03-31
"""
from typing import Union
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f6a7b8c9d011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'artist_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('token', sa.String(64), nullable=False, unique=True),
        sa.Column('artist_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['artist_id'], ['artists.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_artist_tokens_token', 'artist_tokens', ['token'], unique=True)
    op.create_index('idx_artist_tokens_expires', 'artist_tokens', ['expires_at'])


def downgrade() -> None:
    op.drop_table('artist_tokens')
