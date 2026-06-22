"""add spotify_ad_campaigns table

Revision ID: 20260622_000001
Revises: 20260529_000002
Create Date: 2026-06-22 00:00:01.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '20260622_000001'
down_revision = '20260529_000002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'spotify_ad_campaigns',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('artist_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('release_upc', sa.String(length=50), nullable=True),
        sa.Column('track_isrc', sa.String(length=20), nullable=True),
        sa.Column('campaign_name', sa.String(length=255), nullable=False),
        sa.Column('release_name', sa.String(length=255), nullable=True),
        sa.Column('ad_format', sa.String(length=50), nullable=True),
        sa.Column('release_type', sa.String(length=50), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='EUR'),
        sa.Column('budget', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('spend', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('release_date', sa.Date(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('reach', sa.Integer(), nullable=True),
        sa.Column('clicks', sa.Integer(), nullable=True),
        sa.Column('amplified_listeners', sa.Integer(), nullable=True),
        sa.Column('reactivated_listeners', sa.Integer(), nullable=True),
        sa.Column('new_active_listeners', sa.Integer(), nullable=True),
        sa.Column('converted_listeners', sa.Integer(), nullable=True),
        sa.Column('conversion_rate', sa.Numeric(precision=7, scale=4), nullable=True),
        sa.Column('active_streams_per_listener', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('intent_rate', sa.Numeric(precision=7, scale=4), nullable=True),
        sa.Column('playlist_add_rate', sa.Numeric(precision=7, scale=4), nullable=True),
        sa.Column('playlist_adds', sa.Integer(), nullable=True),
        sa.Column('save_rate', sa.Numeric(precision=7, scale=4), nullable=True),
        sa.Column('saves', sa.Integer(), nullable=True),
        sa.Column('advance_ledger_entry_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['artist_id'], ['artists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['advance_ledger_entry_id'], ['advance_ledger.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_spotify_ad_campaigns_artist_id', 'spotify_ad_campaigns', ['artist_id'])
    op.create_index('ix_spotify_ad_campaigns_start_date', 'spotify_ad_campaigns', ['start_date'])
    op.create_index('ix_spotify_ad_campaigns_advance_ledger_entry_id', 'spotify_ad_campaigns', ['advance_ledger_entry_id'])


def downgrade() -> None:
    op.drop_index('ix_spotify_ad_campaigns_advance_ledger_entry_id', table_name='spotify_ad_campaigns')
    op.drop_index('ix_spotify_ad_campaigns_start_date', table_name='spotify_ad_campaigns')
    op.drop_index('ix_spotify_ad_campaigns_artist_id', table_name='spotify_ad_campaigns')
    op.drop_table('spotify_ad_campaigns')
