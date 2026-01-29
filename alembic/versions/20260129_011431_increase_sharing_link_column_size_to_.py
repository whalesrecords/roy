"""Increase sharing_link column size to TEXT

Revision ID: b479337972d3
Revises: 20260127_000001
Create Date: 2026-01-29 01:14:31.049775

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b479337972d3'
down_revision: Union[str, None] = '20260127_000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Change sharing_link from VARCHAR(500) to TEXT
    op.alter_column('promo_submissions', 'sharing_link',
                    existing_type=sa.String(length=500),
                    type_=sa.Text(),
                    existing_nullable=True)


def downgrade() -> None:
    # Revert sharing_link from TEXT to VARCHAR(500)
    op.alter_column('promo_submissions', 'sharing_link',
                    existing_type=sa.Text(),
                    type_=sa.String(length=500),
                    existing_nullable=True)
