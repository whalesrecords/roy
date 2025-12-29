"""Add track_artist_links table for multi-artist support.

Revision ID: 20251229_000003
Revises: 20251229_000002
Create Date: 2025-12-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251229_000003'
down_revision = '20251229_000002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create track_artist_links table
    op.create_table(
        'track_artist_links',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('isrc', sa.String(20), nullable=False),
        sa.Column('artist_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('share_percent', sa.Numeric(precision=5, scale=4), nullable=False),
        sa.Column('track_title', sa.String(500), nullable=True),
        sa.Column('release_title', sa.String(500), nullable=True),
        sa.Column('upc', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['artist_id'], ['artists.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('isrc', 'artist_id', name='uq_track_artist'),
        sa.CheckConstraint('share_percent > 0 AND share_percent <= 1', name='check_share_range'),
    )
    op.create_index('ix_track_artist_links_isrc', 'track_artist_links', ['isrc'])
    op.create_index('ix_track_artist_links_artist_id', 'track_artist_links', ['artist_id'])


def downgrade() -> None:
    op.drop_index('ix_track_artist_links_artist_id', table_name='track_artist_links')
    op.drop_index('ix_track_artist_links_isrc', table_name='track_artist_links')
    op.drop_table('track_artist_links')
