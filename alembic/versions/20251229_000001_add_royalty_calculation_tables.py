"""Add royalty calculation tables

Revision ID: 20251229_000001
Revises:
Create Date: 2025-12-29

This migration adds the following tables for royalty calculation:
- artists: Artist entities
- contracts: Royalty split contracts
- advance_ledger: Advance and recoupment tracking
- royalty_runs: Royalty calculation runs
- royalty_line_items: Individual transaction calculations
- statements: Artist royalty statements
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20251229_000001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums
    contractscope_enum = postgresql.ENUM('track', 'release', 'catalog', name='contractscope', create_type=False)
    contractscope_enum.create(op.get_bind(), checkfirst=True)

    ledgerentrytype_enum = postgresql.ENUM('advance', 'recoupment', name='ledgerentrytype', create_type=False)
    ledgerentrytype_enum.create(op.get_bind(), checkfirst=True)

    royaltyrunstatus_enum = postgresql.ENUM('draft', 'processing', 'completed', 'locked', 'failed', name='royaltyrunstatus', create_type=False)
    royaltyrunstatus_enum.create(op.get_bind(), checkfirst=True)

    statementstatus_enum = postgresql.ENUM('draft', 'finalized', 'paid', name='statementstatus', create_type=False)
    statementstatus_enum.create(op.get_bind(), checkfirst=True)

    # Create artists table
    op.create_table(
        'artists',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('external_id', sa.String(100), nullable=True, unique=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Create contracts table
    op.create_table(
        'contracts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('artist_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('artists.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('scope', sa.Enum('track', 'release', 'catalog', name='contractscope'), nullable=False, index=True),
        sa.Column('scope_id', sa.String(50), nullable=True, index=True),
        sa.Column('artist_share', sa.Numeric(precision=5, scale=4), nullable=False),
        sa.Column('label_share', sa.Numeric(precision=5, scale=4), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.CheckConstraint('artist_share >= 0 AND artist_share <= 1', name='check_artist_share_range'),
        sa.CheckConstraint('label_share >= 0 AND label_share <= 1', name='check_label_share_range'),
        sa.CheckConstraint('artist_share + label_share = 1', name='check_shares_sum_to_one'),
        sa.CheckConstraint(
            "(scope = 'catalog' AND scope_id IS NULL) OR (scope IN ('track', 'release') AND scope_id IS NOT NULL)",
            name='check_scope_id_required'
        ),
    )

    # Create royalty_runs table
    op.create_table(
        'royalty_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('base_currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('status', sa.Enum('draft', 'processing', 'completed', 'locked', 'failed', name='royaltyrunstatus'), nullable=False, index=True, server_default='draft'),
        sa.Column('is_locked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('import_ids', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column('total_transactions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_gross', sa.Numeric(precision=15, scale=6), nullable=False, server_default='0'),
        sa.Column('total_artist_royalties', sa.Numeric(precision=15, scale=6), nullable=False, server_default='0'),
        sa.Column('total_label_royalties', sa.Numeric(precision=15, scale=6), nullable=False, server_default='0'),
        sa.Column('total_recouped', sa.Numeric(precision=15, scale=6), nullable=False, server_default='0'),
        sa.Column('total_net_payable', sa.Numeric(precision=15, scale=6), nullable=False, server_default='0'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('locked_at', sa.DateTime(), nullable=True),
    )

    # Create advance_ledger table
    op.create_table(
        'advance_ledger',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('artist_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('artists.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('entry_type', sa.Enum('advance', 'recoupment', name='ledgerentrytype'), nullable=False, index=True),
        sa.Column('amount', sa.Numeric(precision=15, scale=6), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('royalty_run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('royalty_runs.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('reference', sa.String(255), nullable=True),
        sa.Column('effective_date', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Create royalty_line_items table
    op.create_table(
        'royalty_line_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('royalty_run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('royalty_runs.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('transactions_normalized.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('contract_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('contracts.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('artist_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('artists.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('artist_name', sa.String(255), nullable=False),
        sa.Column('track_title', sa.String(255), nullable=True),
        sa.Column('release_title', sa.String(255), nullable=True),
        sa.Column('isrc', sa.String(12), nullable=True),
        sa.Column('upc', sa.String(14), nullable=True),
        sa.Column('gross_amount', sa.Numeric(precision=15, scale=6), nullable=False),
        sa.Column('original_currency', sa.String(3), nullable=False),
        sa.Column('amount_base', sa.Numeric(precision=15, scale=6), nullable=False),
        sa.Column('fx_rate', sa.Numeric(precision=15, scale=6), nullable=False, server_default='1'),
        sa.Column('artist_share', sa.Numeric(precision=5, scale=4), nullable=False),
        sa.Column('label_share', sa.Numeric(precision=5, scale=4), nullable=False),
        sa.Column('artist_amount', sa.Numeric(precision=15, scale=6), nullable=False),
        sa.Column('label_amount', sa.Numeric(precision=15, scale=6), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Create statements table
    op.create_table(
        'statements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('artist_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('artists.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('royalty_run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('royalty_runs.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('status', sa.Enum('draft', 'finalized', 'paid', name='statementstatus'), nullable=False, index=True, server_default='draft'),
        sa.Column('gross_revenue', sa.Numeric(precision=15, scale=6), nullable=False, server_default='0'),
        sa.Column('artist_royalties', sa.Numeric(precision=15, scale=6), nullable=False, server_default='0'),
        sa.Column('label_royalties', sa.Numeric(precision=15, scale=6), nullable=False, server_default='0'),
        sa.Column('advance_balance_before', sa.Numeric(precision=15, scale=6), nullable=False, server_default='0'),
        sa.Column('recouped', sa.Numeric(precision=15, scale=6), nullable=False, server_default='0'),
        sa.Column('advance_balance_after', sa.Numeric(precision=15, scale=6), nullable=False, server_default='0'),
        sa.Column('net_payable', sa.Numeric(precision=15, scale=6), nullable=False, server_default='0'),
        sa.Column('transaction_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('finalized_at', sa.DateTime(), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('statements')
    op.drop_table('royalty_line_items')
    op.drop_table('advance_ledger')
    op.drop_table('royalty_runs')
    op.drop_table('contracts')
    op.drop_table('artists')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS statementstatus')
    op.execute('DROP TYPE IF EXISTS royaltyrunstatus')
    op.execute('DROP TYPE IF EXISTS ledgerentrytype')
    op.execute('DROP TYPE IF EXISTS contractscope')
