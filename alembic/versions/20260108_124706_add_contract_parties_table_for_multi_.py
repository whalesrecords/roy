"""Add contract_parties table for multi-party contracts

Revision ID: b70c678babaa
Revises: 8f0fb94b0709
Create Date: 2026-01-08 12:47:06.883662

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b70c678babaa'
down_revision: Union[str, None] = '8f0fb94b0709'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create partytype enum
    partytype_enum = postgresql.ENUM('artist', 'label', name='partytype', create_type=False)
    partytype_enum.create(op.get_bind(), checkfirst=True)

    # Create contract_parties table
    op.create_table(
        'contract_parties',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('contract_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('party_type', partytype_enum, nullable=False),
        sa.Column('artist_id', postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column('label_name', sa.String(length=200), nullable=True),
        sa.Column('share_percentage', sa.Numeric(precision=5, scale=4), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['artist_id'], ['artists.id'], ondelete='CASCADE'),
        sa.CheckConstraint(
            "share_percentage >= 0 AND share_percentage <= 1",
            name='check_share_percentage_range'
        ),
        sa.CheckConstraint(
            "(party_type = 'artist' AND artist_id IS NOT NULL AND label_name IS NULL) OR "
            "(party_type = 'label' AND label_name IS NOT NULL AND artist_id IS NULL)",
            name='check_party_type_consistency'
        ),
    )


def downgrade() -> None:
    op.drop_table('contract_parties')
    op.execute('DROP TYPE IF EXISTS partytype')
