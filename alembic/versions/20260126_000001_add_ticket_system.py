"""Add ticket system tables

Revision ID: 20260126_000001
Revises: 20260121_000001
Create Date: 2026-01-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260126_000001'
down_revision: Union[str, None] = '20260121_000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create sequence for ticket numbers
    op.execute("CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1")

    # Create tickets table
    op.create_table(
        'tickets',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('ticket_number', sa.String(20), nullable=False),
        sa.Column('subject', sa.String(255), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('priority', sa.String(20), nullable=False),
        sa.Column('artist_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('assigned_to', sa.String(100), nullable=True),
        sa.Column('last_message_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['artist_id'], ['artists.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticket_number'),
    )
    op.create_index('ix_tickets_ticket_number', 'tickets', ['ticket_number'])
    op.create_index('ix_tickets_artist_id', 'tickets', ['artist_id'])
    op.create_index('ix_tickets_status', 'tickets', ['status'])
    op.create_index('ix_tickets_category', 'tickets', ['category'])
    op.create_index('ix_tickets_last_message_at', 'tickets', ['last_message_at'], postgresql_using='btree', postgresql_ops={'last_message_at': 'DESC'})
    op.create_index('ix_tickets_status_updated', 'tickets', ['status', 'updated_at'], postgresql_using='btree', postgresql_ops={'updated_at': 'DESC'})
    op.create_index('ix_tickets_artist_status', 'tickets', ['artist_id', 'status'])

    # Create ticket_messages table
    op.create_table(
        'ticket_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('ticket_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('sender_type', sa.String(20), nullable=False),
        sa.Column('sender_id', sa.String(100), nullable=True),
        sa.Column('sender_name', sa.String(255), nullable=True),
        sa.Column('is_internal', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('attachments', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['ticket_id'], ['tickets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ticket_messages_ticket_id', 'ticket_messages', ['ticket_id'])
    op.create_index('ix_ticket_messages_created_at', 'ticket_messages', ['created_at'])

    # Create ticket_participants table
    op.create_table(
        'ticket_participants',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('ticket_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('artist_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('last_read_at', sa.DateTime(), nullable=True),
        sa.Column('notifications_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['ticket_id'], ['tickets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['artist_id'], ['artists.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticket_id', 'artist_id', name='uq_ticket_participant'),
    )
    op.create_index('ix_ticket_participants_ticket_id', 'ticket_participants', ['ticket_id'])
    op.create_index('ix_ticket_participants_artist_id', 'ticket_participants', ['artist_id'])


def downgrade() -> None:
    # Drop ticket_participants table
    op.drop_index('ix_ticket_participants_artist_id', table_name='ticket_participants')
    op.drop_index('ix_ticket_participants_ticket_id', table_name='ticket_participants')
    op.drop_table('ticket_participants')

    # Drop ticket_messages table
    op.drop_index('ix_ticket_messages_created_at', table_name='ticket_messages')
    op.drop_index('ix_ticket_messages_ticket_id', table_name='ticket_messages')
    op.drop_table('ticket_messages')

    # Drop tickets table
    op.drop_index('ix_tickets_artist_status', table_name='tickets')
    op.drop_index('ix_tickets_status_updated', table_name='tickets')
    op.drop_index('ix_tickets_last_message_at', table_name='tickets')
    op.drop_index('ix_tickets_category', table_name='tickets')
    op.drop_index('ix_tickets_status', table_name='tickets')
    op.drop_index('ix_tickets_artist_id', table_name='tickets')
    op.drop_index('ix_tickets_ticket_number', table_name='tickets')
    op.drop_table('tickets')

    # Drop sequence
    op.execute("DROP SEQUENCE IF EXISTS ticket_number_seq")
