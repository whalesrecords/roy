"""Add matching system for transaction correlation

Revision ID: 20251229_000007
Revises: 20251229_000006
Create Date: 2024-12-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251229_000007'
down_revision = '20251229_000006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add artist_id, release_id, track_id to transactions_normalized
    op.add_column(
        'transactions_normalized',
        sa.Column('artist_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.add_column(
        'transactions_normalized',
        sa.Column('release_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.add_column(
        'transactions_normalized',
        sa.Column('track_id', postgresql.UUID(as_uuid=True), nullable=True)
    )

    # Add foreign key for artist_id
    op.create_foreign_key(
        'fk_transactions_artist_id',
        'transactions_normalized',
        'artists',
        ['artist_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Add indexes for the new columns
    op.create_index(
        'ix_transactions_normalized_artist_id',
        'transactions_normalized',
        ['artist_id']
    )

    # Create match_suggestions table
    op.create_table(
        'match_suggestions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('candidate_artist_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('candidate_release_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('candidate_track_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('method', sa.String(50), nullable=False),  # isrc|upc|fuzzy_title|fuzzy_artist
        sa.Column('status', sa.String(20), nullable=False, default='pending'),  # pending|accepted|rejected
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('resolved_by', sa.String(255), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),

        # Foreign keys
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions_normalized.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['candidate_artist_id'], ['artists.id'], ondelete='CASCADE'),
    )

    # Add indexes for match_suggestions
    op.create_index('ix_match_suggestions_transaction_id', 'match_suggestions', ['transaction_id'])
    op.create_index('ix_match_suggestions_status', 'match_suggestions', ['status'])
    op.create_index('ix_match_suggestions_candidate_artist_id', 'match_suggestions', ['candidate_artist_id'])


def downgrade() -> None:
    # Drop match_suggestions table
    op.drop_index('ix_match_suggestions_candidate_artist_id', table_name='match_suggestions')
    op.drop_index('ix_match_suggestions_status', table_name='match_suggestions')
    op.drop_index('ix_match_suggestions_transaction_id', table_name='match_suggestions')
    op.drop_table('match_suggestions')

    # Remove columns from transactions_normalized
    op.drop_index('ix_transactions_normalized_artist_id', table_name='transactions_normalized')
    op.drop_constraint('fk_transactions_artist_id', 'transactions_normalized', type_='foreignkey')
    op.drop_column('transactions_normalized', 'track_id')
    op.drop_column('transactions_normalized', 'release_id')
    op.drop_column('transactions_normalized', 'artist_id')
