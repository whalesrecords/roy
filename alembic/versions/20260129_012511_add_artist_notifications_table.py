"""Add artist_notifications table

Revision ID: d255679bcba9
Revises: b479337972d3
Create Date: 2026-01-29 01:25:11.305945

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd255679bcba9'
down_revision: Union[str, None] = 'b479337972d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create artist_notifications table
    op.create_table(
        'artist_notifications',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('artist_id', sa.UUID(), nullable=False),
        sa.Column('notification_type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('link', sa.String(length=500), nullable=True),
        sa.Column('data', sa.Text(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['artist_id'], ['artists.id'], ondelete='CASCADE'),
    )

    # Create indexes
    op.create_index('ix_artist_notifications_artist_id', 'artist_notifications', ['artist_id'])
    op.create_index('ix_artist_notifications_type', 'artist_notifications', ['notification_type'])
    op.create_index('ix_artist_notifications_is_read', 'artist_notifications', ['is_read'])
    op.create_index('ix_artist_notifications_created_at', 'artist_notifications', ['created_at'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_artist_notifications_created_at', 'artist_notifications')
    op.drop_index('ix_artist_notifications_is_read', 'artist_notifications')
    op.drop_index('ix_artist_notifications_type', 'artist_notifications')
    op.drop_index('ix_artist_notifications_artist_id', 'artist_notifications')

    # Drop table
    op.drop_table('artist_notifications')
