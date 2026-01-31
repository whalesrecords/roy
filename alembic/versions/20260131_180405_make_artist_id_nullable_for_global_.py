"""make artist_id nullable for global notifications

Revision ID: 613acf3db652
Revises: 8e96a6e20f14
Create Date: 2026-01-31 18:04:05.295264

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '613acf3db652'
down_revision: Union[str, None] = '8e96a6e20f14'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make artist_id nullable to support global admin messages
    op.alter_column('artist_notifications', 'artist_id',
                    existing_type=sa.UUID(),
                    nullable=True)


def downgrade() -> None:
    # Delete global notifications (artist_id IS NULL) before reverting
    op.execute("DELETE FROM artist_notifications WHERE artist_id IS NULL")

    # Make artist_id NOT NULL again
    op.alter_column('artist_notifications', 'artist_id',
                    existing_type=sa.UUID(),
                    nullable=False)
