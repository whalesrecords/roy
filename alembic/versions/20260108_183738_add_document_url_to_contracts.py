"""Add document_url to contracts

Revision ID: 42fb40cd5ae4
Revises: db20eb1931ea
Create Date: 2026-01-08 18:37:38.728790

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '42fb40cd5ae4'
down_revision: Union[str, None] = 'db20eb1931ea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add document_url column to contracts table
    op.add_column('contracts', sa.Column('document_url', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove document_url column from contracts table
    op.drop_column('contracts', 'document_url')
