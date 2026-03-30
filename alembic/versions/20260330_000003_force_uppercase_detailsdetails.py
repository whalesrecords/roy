"""Force add DETAILSDETAILS uppercase to importsource enum (autocommit)

Revision ID: e5f6a7b8c910
Revises: d4e5f6a7b809
Create Date: 2026-03-30 19:30:00.000000

SAEnum(ImportSource) uses the Python enum member NAME (DETAILSDETAILS)
not the .value ("detailsdetails"). The DB needs the uppercase variant.
Uses AUTOCOMMIT to bypass the transaction restriction on ALTER TYPE ADD VALUE.

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'e5f6a7b8c910'
down_revision: Union[str, None] = 'd4e5f6a7b809'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ADD VALUE must run outside a transaction on PG < 12.
    # Use AUTOCOMMIT to be safe on all versions.
    conn = op.get_bind()
    conn = conn.execution_options(isolation_level='AUTOCOMMIT')
    conn.execute(sa.text("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'DETAILSDETAILS'"))
    conn.execute(sa.text("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'BELIEVE_UK'"))
    conn.execute(sa.text("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'BELIEVE_FR'"))
    conn.execute(sa.text("ALTER TYPE importsource ADD VALUE IF NOT EXISTS 'CDBABY'"))
    conn.execute(sa.text("ALTER TYPE importstatus ADD VALUE IF NOT EXISTS 'PROCESSING'"))
    conn.execute(sa.text("ALTER TYPE importstatus ADD VALUE IF NOT EXISTS 'PARTIAL'"))


def downgrade() -> None:
    pass
