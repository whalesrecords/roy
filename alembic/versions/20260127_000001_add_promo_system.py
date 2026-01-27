"""Add promo system tables

Revision ID: 20260127_000001
Revises: 20260126_000001
Create Date: 2026-01-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260127_000001'
down_revision: Union[str, None] = '20260126_000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create promo_campaigns table
    op.create_table(
        'promo_campaigns',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('artist_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('source', sa.String(20), nullable=False),
        sa.Column('release_upc', sa.String(50), nullable=True),
        sa.Column('track_isrc', sa.String(20), nullable=True),
        sa.Column('budget', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['artist_id'], ['artists.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_promo_campaigns_artist_id', 'promo_campaigns', ['artist_id'])
    op.create_index('ix_promo_campaigns_source', 'promo_campaigns', ['source'])
    op.create_index('ix_promo_campaigns_status', 'promo_campaigns', ['status'])

    # Create promo_submissions table
    op.create_table(
        'promo_submissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('artist_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('release_upc', sa.String(50), nullable=True),
        sa.Column('track_isrc', sa.String(20), nullable=True),
        sa.Column('song_title', sa.String(255), nullable=False),
        sa.Column('source', sa.String(20), nullable=False),
        sa.Column('campaign_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('campaign_url', sa.String(500), nullable=True),
        # SubmitHub fields
        sa.Column('outlet_name', sa.String(255), nullable=True),
        sa.Column('outlet_type', sa.String(100), nullable=True),
        sa.Column('action', sa.String(50), nullable=True),
        sa.Column('listen_time', sa.Integer(), nullable=True),
        # Groover fields
        sa.Column('influencer_name', sa.String(255), nullable=True),
        sa.Column('influencer_type', sa.String(100), nullable=True),
        sa.Column('decision', sa.String(100), nullable=True),
        sa.Column('sharing_link', sa.String(500), nullable=True),
        # Common fields
        sa.Column('feedback', sa.Text(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('responded_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['artist_id'], ['artists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['campaign_id'], ['promo_campaigns.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['release_upc'], ['release_artwork.upc'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['track_isrc'], ['track_artwork.isrc'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_promo_submissions_artist_id', 'promo_submissions', ['artist_id'])
    op.create_index('ix_promo_submissions_release_upc', 'promo_submissions', ['release_upc'])
    op.create_index('ix_promo_submissions_track_isrc', 'promo_submissions', ['track_isrc'])
    op.create_index('ix_promo_submissions_source', 'promo_submissions', ['source'])
    op.create_index('ix_promo_submissions_campaign_id', 'promo_submissions', ['campaign_id'])
    op.create_index('ix_promo_submissions_action', 'promo_submissions', ['action'])
    op.create_index('ix_promo_submissions_decision', 'promo_submissions', ['decision'])
    op.create_index('ix_promo_submissions_outlet_name', 'promo_submissions', ['outlet_name'])
    op.create_index('ix_promo_submissions_influencer_name', 'promo_submissions', ['influencer_name'])
    op.create_index('ix_promo_submissions_submitted_at', 'promo_submissions', ['submitted_at'], postgresql_using='btree', postgresql_ops={'submitted_at': 'DESC'})
    op.create_index('ix_promo_submissions_artist_source', 'promo_submissions', ['artist_id', 'source'])

    # Add promo_submission_id column to advance_ledger_entries
    op.add_column(
        'advance_ledger',
        sa.Column('promo_submission_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'fk_advance_ledger_promo_submission',
        'advance_ledger',
        'promo_submissions',
        ['promo_submission_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_advance_ledger_promo_submission_id', 'advance_ledger', ['promo_submission_id'])


def downgrade() -> None:
    # Drop promo_submission_id from advance_ledger
    op.drop_index('ix_advance_ledger_promo_submission_id', table_name='advance_ledger')
    op.drop_constraint('fk_advance_ledger_promo_submission', 'advance_ledger', type_='foreignkey')
    op.drop_column('advance_ledger', 'promo_submission_id')

    # Drop promo_submissions table
    op.drop_index('ix_promo_submissions_artist_source', table_name='promo_submissions')
    op.drop_index('ix_promo_submissions_submitted_at', table_name='promo_submissions')
    op.drop_index('ix_promo_submissions_influencer_name', table_name='promo_submissions')
    op.drop_index('ix_promo_submissions_outlet_name', table_name='promo_submissions')
    op.drop_index('ix_promo_submissions_decision', table_name='promo_submissions')
    op.drop_index('ix_promo_submissions_action', table_name='promo_submissions')
    op.drop_index('ix_promo_submissions_campaign_id', table_name='promo_submissions')
    op.drop_index('ix_promo_submissions_source', table_name='promo_submissions')
    op.drop_index('ix_promo_submissions_track_isrc', table_name='promo_submissions')
    op.drop_index('ix_promo_submissions_release_upc', table_name='promo_submissions')
    op.drop_index('ix_promo_submissions_artist_id', table_name='promo_submissions')
    op.drop_table('promo_submissions')

    # Drop promo_campaigns table
    op.drop_index('ix_promo_campaigns_status', table_name='promo_campaigns')
    op.drop_index('ix_promo_campaigns_source', table_name='promo_campaigns')
    op.drop_index('ix_promo_campaigns_artist_id', table_name='promo_campaigns')
    op.drop_table('promo_campaigns')
