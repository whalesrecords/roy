"""add share_physical and share_digital to contract_parties

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-10 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f607'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add share_physical column (nullable, uses share_percentage as fallback)
    op.add_column('contract_parties', sa.Column('share_physical', sa.Numeric(precision=5, scale=4), nullable=True))
    # Add share_digital column (nullable, uses share_percentage as fallback)
    op.add_column('contract_parties', sa.Column('share_digital', sa.Numeric(precision=5, scale=4), nullable=True))


def downgrade() -> None:
    op.drop_column('contract_parties', 'share_digital')
    op.drop_column('contract_parties', 'share_physical')
