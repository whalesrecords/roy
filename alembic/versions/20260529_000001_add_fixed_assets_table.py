"""add fixed_assets table

Revision ID: 20260529_000001
Revises: 20260524_000001
Create Date: 2026-05-29 00:00:01.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260529_000001'
down_revision = '20260524_000001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    asset_category = sa.Enum(
        'construction', 'studio_gear', 'tooling', 'fittings',
        'vehicle', 'computer', 'software', 'other',
        name='assetcategory',
    )
    depreciation_method = sa.Enum('linear', 'degressive', name='depreciationmethod')
    asset_status = sa.Enum('active', 'disposed', 'sold', name='assetstatus')

    op.create_table(
        'fixed_assets',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=300), nullable=False),
        sa.Column('category', asset_category, nullable=False, server_default='other'),
        sa.Column('pcg_account', sa.String(length=10), nullable=False, server_default='218800'),
        sa.Column('internal_ref', sa.String(length=50), nullable=True),
        sa.Column('purchase_date', sa.Date(), nullable=False),
        sa.Column('purchase_amount_ht', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('vat_rate', sa.Numeric(precision=5, scale=2), nullable=False, server_default='20.0'),
        sa.Column('useful_life_months', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('depreciation_method', depreciation_method, nullable=False, server_default='linear'),
        sa.Column('location', sa.String(length=200), nullable=True),
        sa.Column('serial_number', sa.String(length=100), nullable=True),
        sa.Column('supplier', sa.String(length=200), nullable=True),
        sa.Column('invoice_reference', sa.String(length=100), nullable=True),
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', asset_status, nullable=False, server_default='active'),
        sa.Column('disposal_date', sa.Date(), nullable=True),
        sa.Column('disposal_amount', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_fixed_assets_pcg_account', 'fixed_assets', ['pcg_account'])
    op.create_index('ix_fixed_assets_status', 'fixed_assets', ['status'])


def downgrade() -> None:
    op.drop_index('ix_fixed_assets_status', table_name='fixed_assets')
    op.drop_index('ix_fixed_assets_pcg_account', table_name='fixed_assets')
    op.drop_table('fixed_assets')
    sa.Enum(name='assetstatus').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='depreciationmethod').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='assetcategory').drop(op.get_bind(), checkfirst=False)
