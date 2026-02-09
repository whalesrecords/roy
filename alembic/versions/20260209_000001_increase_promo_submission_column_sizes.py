"""increase promo_submission column sizes for Groover data

Revision ID: a1b2c3d4e5f6
Revises: 613acf3db652
Create Date: 2026-02-09 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '613acf3db652'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('promo_submissions', 'decision',
                     type_=sa.String(500),
                     existing_type=sa.String(100),
                     existing_nullable=True)
    op.alter_column('promo_submissions', 'influencer_type',
                     type_=sa.String(255),
                     existing_type=sa.String(100),
                     existing_nullable=True)
    op.alter_column('promo_submissions', 'outlet_type',
                     type_=sa.String(255),
                     existing_type=sa.String(100),
                     existing_nullable=True)


def downgrade() -> None:
    op.alter_column('promo_submissions', 'decision',
                     type_=sa.String(100),
                     existing_type=sa.String(500),
                     existing_nullable=True)
    op.alter_column('promo_submissions', 'influencer_type',
                     type_=sa.String(100),
                     existing_type=sa.String(255),
                     existing_nullable=True)
    op.alter_column('promo_submissions', 'outlet_type',
                     type_=sa.String(100),
                     existing_type=sa.String(255),
                     existing_nullable=True)
