"""Change document_url to TEXT type

Revision ID: db20eb1931ea
Revises: b70c678babaa
Create Date: 2026-01-08 18:18:42.752496

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'db20eb1931ea'
down_revision: Union[str, None] = 'b70c678babaa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Change document_url from VARCHAR(500) to TEXT to support base64-encoded PDFs
    op.alter_column('advance_ledger', 'document_url',
                    existing_type=sa.String(500),
                    type_=sa.Text(),
                    existing_nullable=True)


def downgrade() -> None:
    # Change document_url back to VARCHAR(500)
    op.alter_column('advance_ledger', 'document_url',
                    existing_type=sa.Text(),
                    type_=sa.String(500),
                    existing_nullable=True)
