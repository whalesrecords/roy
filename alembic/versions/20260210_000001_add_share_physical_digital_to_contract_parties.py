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
    # Use raw SQL with IF NOT EXISTS for idempotency
    op.execute("ALTER TABLE contract_parties ADD COLUMN IF NOT EXISTS share_physical NUMERIC(5,4)")
    op.execute("ALTER TABLE contract_parties ADD COLUMN IF NOT EXISTS share_digital NUMERIC(5,4)")


def downgrade() -> None:
    op.drop_column('contract_parties', 'share_digital')
    op.drop_column('contract_parties', 'share_physical')
