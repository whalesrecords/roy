"""add other-releases impact columns to spotify_ad_campaigns

Revision ID: 20260622_000002
Revises: 20260622_000001
Create Date: 2026-06-22 00:00:02.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '20260622_000002'
down_revision = '20260622_000001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('spotify_ad_campaigns', sa.Column('listeners_other_releases', sa.Integer(), nullable=True))
    op.add_column('spotify_ad_campaigns', sa.Column('streams_per_listener_other_releases', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('spotify_ad_campaigns', sa.Column('saves_other_releases', sa.Integer(), nullable=True))
    op.add_column('spotify_ad_campaigns', sa.Column('playlist_adds_other_releases', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('spotify_ad_campaigns', 'playlist_adds_other_releases')
    op.drop_column('spotify_ad_campaigns', 'saves_other_releases')
    op.drop_column('spotify_ad_campaigns', 'streams_per_listener_other_releases')
    op.drop_column('spotify_ad_campaigns', 'listeners_other_releases')
