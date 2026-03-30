"""Convert imports.source and imports.status from enum to varchar

Revision ID: f6a7b8c9d011
Revises: e5f6a7b8c910
Create Date: 2026-03-30 20:00:00.000000

SAEnum causes constant issues with ALTER TYPE ADD VALUE inside transactions.
Converting to VARCHAR eliminates all enum casting problems permanently.

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'f6a7b8c9d011'
down_revision: Union[str, None] = 'e5f6a7b8c910'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Convert source column from enum to varchar, preserving existing data
    op.execute("""
        ALTER TABLE imports
        ALTER COLUMN source TYPE VARCHAR(50)
        USING source::text
    """)
    # Convert status column from enum to varchar, preserving existing data
    op.execute("""
        ALTER TABLE imports
        ALTER COLUMN status TYPE VARCHAR(50)
        USING status::text
    """)


def downgrade() -> None:
    pass
