"""Add social media links to artists

Revision ID: 8e96a6e20f14
Revises: d255679bcba9
Create Date: 2026-01-31 17:04:30.260466

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8e96a6e20f14'
down_revision: Union[str, None] = 'd255679bcba9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add social media link columns to artists table
    op.add_column('artists', sa.Column('instagram_url', sa.String(500), nullable=True))
    op.add_column('artists', sa.Column('twitter_url', sa.String(500), nullable=True))
    op.add_column('artists', sa.Column('facebook_url', sa.String(500), nullable=True))
    op.add_column('artists', sa.Column('tiktok_url', sa.String(500), nullable=True))
    op.add_column('artists', sa.Column('youtube_url', sa.String(500), nullable=True))


def downgrade() -> None:
    # Remove social media link columns from artists table
    op.drop_column('artists', 'youtube_url')
    op.drop_column('artists', 'tiktok_url')
    op.drop_column('artists', 'facebook_url')
    op.drop_column('artists', 'twitter_url')
    op.drop_column('artists', 'instagram_url')
