"""Add catalog metadata fields to artwork tables

Revision ID: 20260113_000001
Revises: 20260110_000001
Create Date: 2026-01-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260113_000001'
down_revision: Union[str, None] = '20260110_000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add catalog metadata to release_artwork table
    op.add_column(
        'release_artwork',
        sa.Column('release_date', sa.String(20), nullable=True)
    )
    op.add_column(
        'release_artwork',
        sa.Column('genres', postgresql.JSON(), nullable=True)
    )
    op.add_column(
        'release_artwork',
        sa.Column('label', sa.String(500), nullable=True)
    )
    op.add_column(
        'release_artwork',
        sa.Column('total_tracks', sa.Integer(), nullable=True)
    )
    op.add_column(
        'release_artwork',
        sa.Column('album_type', sa.String(50), nullable=True)
    )

    # Add catalog metadata to track_artwork table
    op.add_column(
        'track_artwork',
        sa.Column('duration_ms', sa.Integer(), nullable=True)
    )
    op.add_column(
        'track_artwork',
        sa.Column('track_number', sa.Integer(), nullable=True)
    )
    op.add_column(
        'track_artwork',
        sa.Column('disc_number', sa.Integer(), nullable=True)
    )
    op.add_column(
        'track_artwork',
        sa.Column('artists', postgresql.JSON(), nullable=True)
    )
    op.add_column(
        'track_artwork',
        sa.Column('release_upc', sa.String(20), nullable=True)
    )

    # Create index on release_upc for faster track lookups
    op.create_index(
        'ix_track_artwork_release_upc',
        'track_artwork',
        ['release_upc']
    )


def downgrade() -> None:
    # Remove index
    op.drop_index('ix_track_artwork_release_upc', table_name='track_artwork')

    # Remove track_artwork columns
    op.drop_column('track_artwork', 'release_upc')
    op.drop_column('track_artwork', 'artists')
    op.drop_column('track_artwork', 'disc_number')
    op.drop_column('track_artwork', 'track_number')
    op.drop_column('track_artwork', 'duration_ms')

    # Remove release_artwork columns
    op.drop_column('release_artwork', 'album_type')
    op.drop_column('release_artwork', 'total_tracks')
    op.drop_column('release_artwork', 'label')
    op.drop_column('release_artwork', 'genres')
    op.drop_column('release_artwork', 'release_date')
