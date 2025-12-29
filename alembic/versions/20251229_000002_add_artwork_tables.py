"""Add artwork tables for releases and tracks.

Revision ID: 20251229_000002
Revises: 20251229_000001
Create Date: 2025-12-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251229_000002'
down_revision = '20251229_000001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create release_artwork table
    op.create_table(
        'release_artwork',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('upc', sa.String(20), nullable=False),
        sa.Column('spotify_id', sa.String(100), nullable=True),
        sa.Column('name', sa.String(500), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('image_url_small', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('upc'),
    )
    op.create_index('ix_release_artwork_upc', 'release_artwork', ['upc'])

    # Create track_artwork table
    op.create_table(
        'track_artwork',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('isrc', sa.String(20), nullable=False),
        sa.Column('spotify_id', sa.String(100), nullable=True),
        sa.Column('name', sa.String(500), nullable=True),
        sa.Column('album_name', sa.String(500), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('image_url_small', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('isrc'),
    )
    op.create_index('ix_track_artwork_isrc', 'track_artwork', ['isrc'])


def downgrade() -> None:
    op.drop_index('ix_track_artwork_isrc', table_name='track_artwork')
    op.drop_table('track_artwork')
    op.drop_index('ix_release_artwork_upc', table_name='release_artwork')
    op.drop_table('release_artwork')
