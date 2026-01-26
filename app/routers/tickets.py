"""
Admin Tickets Router

Handles admin ticket management (view all, respond, update status).
"""

import logging
import json
import uuid
from datetime import datetime
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.artist import Artist
from app.models.ticket import Ticket, TicketStatus, TicketCategory, TicketPriority
from app.models.ticket_message import TicketMessage, MessageSender
from app.models.ticket_participant import TicketParticipant
from app.models.notification import Notification, NotificationType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tickets", tags=["tickets"])


async def verify_admin_token(x_admin_token: Annotated[str, Header()]) -> str:
    """Verify the admin token from header."""
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )
    return x_admin_token


# ============ Schemas ============

class TicketStatsResponse(BaseModel):
    """Ticket statistics for dashboard."""
    total: int
    open: int
    in_progress: int
    resolved: int
    closed: int
    by_category: dict


class AdminTicketCreateRequest(BaseModel):
    """Create ticket from admin (multi-artist)."""
    subject: str
    category: str
    message: str
    artist_ids: List[str]
    priority: Optional[str] = "medium"


class AdminTicketUpdateRequest(BaseModel):
    """Update ticket status, priority, or assignment."""
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None


class TicketMessageCreate(BaseModel):
    """Add message to ticket."""
    message: str
    is_internal: Optional[bool] = False


class TicketMessageResponse(BaseModel):
    """Ticket message response."""
    id: str
    message: str
    sender_type: str
    sender_name: Optional[str]
    is_internal: bool
    created_at: str


class TicketResponse(BaseModel):
    """Ticket list item response."""
    id: str
    ticket_number: str
    subject: str
    category: str
    category_label: str
    status: str
    status_label: str
    priority: str
    priority_label: str
    artist_names: List[str]
    unread_count: int
    last_message_at: str
    created_at: str


class TicketDetailResponse(BaseModel):
    """Detailed ticket response with all messages."""
    id: str
    ticket_number: str
    subject: str
    category: str
    category_label: str
    status: str
    status_label: str
    priority: str
    priority_label: str
    assigned_to: Optional[str]
    messages: List[TicketMessageResponse]
    participants: List[str]
    created_at: str
    updated_at: str
    resolved_at: Optional[str]
    closed_at: Optional[str]


# Labels
CATEGORY_LABELS = {
    "payment": "Paiements",
    "profile": "Profil",
    "technical": "Technique",
    "royalties": "Royalties",
    "contracts": "Contrats",
    "catalog": "Catalogue",
    "general": "Général",
    "other": "Autre",
}

STATUS_LABELS = {
    "open": "Ouvert",
    "in_progress": "En cours",
    "resolved": "Résolu",
    "closed": "Fermé",
}

PRIORITY_LABELS = {
    "low": "Basse",
    "medium": "Moyenne",
    "high": "Haute",
    "urgent": "Urgente",
}


# ============ Endpoints ============

@router.get("/stats", response_model=TicketStatsResponse)
async def get_ticket_stats(
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """Get ticket statistics for dashboard."""
    # Count by status
    total_result = await db.execute(select(func.count(Ticket.id)))
    total = total_result.scalar() or 0

    open_result = await db.execute(
        select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.OPEN.value)
    )
    open_count = open_result.scalar() or 0

    in_progress_result = await db.execute(
        select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.IN_PROGRESS.value)
    )
    in_progress = in_progress_result.scalar() or 0

    resolved_result = await db.execute(
        select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.RESOLVED.value)
    )
    resolved = resolved_result.scalar() or 0

    closed_result = await db.execute(
        select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.CLOSED.value)
    )
    closed = closed_result.scalar() or 0

    # Count by category
    category_result = await db.execute(
        select(Ticket.category, func.count(Ticket.id))
        .group_by(Ticket.category)
    )
    by_category = {row[0]: row[1] for row in category_result.all()}

    return {
        "total": total,
        "open": open_count,
        "in_progress": in_progress,
        "resolved": resolved,
        "closed": closed,
        "by_category": by_category,
    }


@router.get("", response_model=List[TicketResponse])
async def list_all_tickets(
    status: Optional[str] = None,
    category: Optional[str] = None,
    artist_id: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """List all tickets with filters."""
    query = select(Ticket)

    # Apply filters
    if status:
        query = query.where(Ticket.status == status)
    if category:
        query = query.where(Ticket.category == category)
    if artist_id:
        query = query.where(
            or_(
                Ticket.artist_id == uuid.UUID(artist_id),
                Ticket.id.in_(
                    select(TicketParticipant.ticket_id).where(
                        TicketParticipant.artist_id == uuid.UUID(artist_id)
                    )
                )
            )
        )
    if priority:
        query = query.where(Ticket.priority == priority)
    if search:
        query = query.where(
            or_(
                Ticket.ticket_number.ilike(f"%{search}%"),
                Ticket.subject.ilike(f"%{search}%"),
            )
        )

    # Order and paginate
    query = query.order_by(Ticket.last_message_at.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    tickets = result.scalars().all()

    # Get participant names for each ticket
    response = []
    for ticket in tickets:
        participants_result = await db.execute(
            select(Artist.name)
            .join(TicketParticipant)
            .where(TicketParticipant.ticket_id == ticket.id)
        )
        artist_names = [name for name in participants_result.scalars().all()]

        # Count unread messages for admin (all messages, including internal)
        # For simplicity, we'll just count all messages (admin can track read separately later)
        unread_count = 0

        response.append({
            "id": str(ticket.id),
            "ticket_number": ticket.ticket_number,
            "subject": ticket.subject,
            "category": ticket.category,
            "category_label": CATEGORY_LABELS.get(ticket.category, ticket.category),
            "status": ticket.status,
            "status_label": STATUS_LABELS.get(ticket.status, ticket.status),
            "priority": ticket.priority,
            "priority_label": PRIORITY_LABELS.get(ticket.priority, ticket.priority),
            "artist_names": artist_names,
            "unread_count": unread_count,
            "last_message_at": ticket.last_message_at.isoformat(),
            "created_at": ticket.created_at.isoformat(),
        })

    return response


@router.post("", response_model=TicketDetailResponse)
async def create_admin_ticket(
    data: AdminTicketCreateRequest,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """Create a ticket from admin side (multi-artist messaging)."""
    from app.services.email_service import send_ticket_created_notification

    # Validate artist IDs
    artist_uuids = [uuid.UUID(aid) for aid in data.artist_ids]
    artists_result = await db.execute(
        select(Artist).where(Artist.id.in_(artist_uuids))
    )
    artists = artists_result.scalars().all()

    if len(artists) != len(artist_uuids):
        raise HTTPException(status_code=404, detail="Un ou plusieurs artistes non trouvés")

    # Generate ticket number
    ticket_num_result = await db.execute(text("SELECT nextval('ticket_number_seq')"))
    ticket_num = ticket_num_result.scalar()
    ticket_number = f"TKT-{ticket_num:06d}"

    # Create ticket (artist_id=None if multiple artists)
    ticket = Ticket(
        ticket_number=ticket_number,
        subject=data.subject,
        category=data.category,
        status=TicketStatus.OPEN.value,
        priority=data.priority or TicketPriority.MEDIUM.value,
        artist_id=artists[0].id if len(artists) == 1 else None,
        last_message_at=datetime.utcnow(),
    )
    db.add(ticket)
    await db.flush()

    # Create first message
    message = TicketMessage(
        ticket_id=ticket.id,
        message=data.message,
        sender_type=MessageSender.ADMIN.value,
        sender_name="Admin",
    )
    db.add(message)

    # Add all artists as participants
    for artist in artists:
        participant = TicketParticipant(
            ticket_id=ticket.id,
            artist_id=artist.id,
        )
        db.add(participant)

    await db.commit()
    await db.refresh(ticket)

    # Create notifications for all artists
    for artist in artists:
        notification = Notification(
            notification_type=NotificationType.TICKET_CREATED.value,
            artist_id=artist.id,
            title=f"Nouveau message - {ticket_number}",
            message=f"Admin: {data.subject}",
            data=json.dumps({
                "ticket_id": str(ticket.id),
                "ticket_number": ticket_number,
                "category": data.category,
            }),
        )
        db.add(notification)

    await db.commit()

    # Send emails to all artists
    try:
        for artist in artists:
            artist_url = f"https://artist.whalesrecords.com/support/{ticket.id}"
            await send_ticket_created_notification(
                ticket_number=ticket_number,
                artist_name=artist.name,
                subject=data.subject,
                category=CATEGORY_LABELS.get(data.category, data.category),
                message=data.message,
                ticket_url=artist_url,
            )
    except Exception as e:
        logger.error(f"Failed to send ticket emails: {e}")

    return {
        "id": str(ticket.id),
        "ticket_number": ticket_number,
        "subject": data.subject,
        "category": data.category,
        "category_label": CATEGORY_LABELS.get(data.category, data.category),
        "status": ticket.status,
        "status_label": STATUS_LABELS.get(ticket.status, ticket.status),
        "priority": ticket.priority,
        "priority_label": PRIORITY_LABELS.get(ticket.priority, ticket.priority),
        "assigned_to": ticket.assigned_to,
        "messages": [{
            "id": str(message.id),
            "message": data.message,
            "sender_type": MessageSender.ADMIN.value,
            "sender_name": "Admin",
            "is_internal": False,
            "created_at": message.created_at.isoformat(),
        }],
        "participants": [a.name for a in artists],
        "created_at": ticket.created_at.isoformat(),
        "updated_at": ticket.updated_at.isoformat(),
        "resolved_at": None,
        "closed_at": None,
    }


@router.get("/{ticket_id}", response_model=TicketDetailResponse)
async def get_admin_ticket_detail(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """Get ticket details (admin view includes internal notes)."""
    result = await db.execute(
        select(Ticket).where(Ticket.id == uuid.UUID(ticket_id))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")

    # Get all messages (including internal notes)
    messages_result = await db.execute(
        select(TicketMessage)
        .where(TicketMessage.ticket_id == ticket.id)
        .order_by(TicketMessage.created_at)
    )
    messages = messages_result.scalars().all()

    # Get participants
    participants_result = await db.execute(
        select(Artist)
        .join(TicketParticipant)
        .where(TicketParticipant.ticket_id == ticket.id)
    )
    participants = participants_result.scalars().all()

    return {
        "id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "subject": ticket.subject,
        "category": ticket.category,
        "category_label": CATEGORY_LABELS.get(ticket.category, ticket.category),
        "status": ticket.status,
        "status_label": STATUS_LABELS.get(ticket.status, ticket.status),
        "priority": ticket.priority,
        "priority_label": PRIORITY_LABELS.get(ticket.priority, ticket.priority),
        "assigned_to": ticket.assigned_to,
        "messages": [
            {
                "id": str(m.id),
                "message": m.message,
                "sender_type": m.sender_type,
                "sender_name": m.sender_name,
                "is_internal": m.is_internal,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
        "participants": [p.name for p in participants],
        "created_at": ticket.created_at.isoformat(),
        "updated_at": ticket.updated_at.isoformat(),
        "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
        "closed_at": ticket.closed_at.isoformat() if ticket.closed_at else None,
    }


@router.put("/{ticket_id}", response_model=TicketDetailResponse)
async def update_ticket(
    ticket_id: str,
    data: AdminTicketUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """Update ticket status, priority, or assignment."""
    from app.services.email_service import send_ticket_status_notification

    result = await db.execute(
        select(Ticket).where(Ticket.id == uuid.UUID(ticket_id))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")

    old_status = ticket.status

    # Update fields
    if data.status:
        ticket.status = data.status
        if data.status == TicketStatus.RESOLVED.value:
            ticket.resolved_at = datetime.utcnow()
        elif data.status == TicketStatus.CLOSED.value:
            ticket.closed_at = datetime.utcnow()

    if data.priority:
        ticket.priority = data.priority

    if data.assigned_to is not None:
        ticket.assigned_to = data.assigned_to

    await db.commit()
    await db.refresh(ticket)

    # If status changed, create system message
    if data.status and data.status != old_status:
        system_message = TicketMessage(
            ticket_id=ticket.id,
            message=f"Statut changé: {STATUS_LABELS.get(old_status, old_status)} → {STATUS_LABELS.get(data.status, data.status)}",
            sender_type=MessageSender.SYSTEM.value,
            sender_name="Système",
        )
        db.add(system_message)
        await db.commit()

        # Get participants
        participants_result = await db.execute(
            select(Artist)
            .join(TicketParticipant)
            .where(TicketParticipant.ticket_id == ticket.id)
        )
        participants = participants_result.scalars().all()

        # Create notifications for participants
        for artist in participants:
            notification = Notification(
                notification_type=NotificationType.TICKET_UPDATED.value,
                artist_id=artist.id,
                title=f"Ticket mis à jour - {ticket.ticket_number}",
                message=f"Statut: {STATUS_LABELS.get(data.status, data.status)}",
                data=json.dumps({
                    "ticket_id": str(ticket.id),
                    "ticket_number": ticket.ticket_number,
                    "old_status": old_status,
                    "new_status": data.status,
                }),
            )
            db.add(notification)

        await db.commit()

        # Send emails
        try:
            artist_emails = [a.email for a in participants if a.email]
            if artist_emails:
                ticket_url = f"https://artist.whalesrecords.com/support/{ticket.id}"
                await send_ticket_status_notification(
                    ticket_number=ticket.ticket_number,
                    subject=ticket.subject,
                    old_status=old_status,
                    new_status=data.status,
                    artist_emails=artist_emails,
                    ticket_url=ticket_url,
                )
        except Exception as e:
            logger.error(f"Failed to send status email: {e}")

    # Get full detail for response
    return await get_admin_ticket_detail(ticket_id, db, _token)


@router.post("/{ticket_id}/messages", response_model=TicketMessageResponse)
async def add_admin_message(
    ticket_id: str,
    data: TicketMessageCreate,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """Add a message to a ticket (admin)."""
    from app.services.email_service import send_ticket_message_notification

    result = await db.execute(
        select(Ticket).where(Ticket.id == uuid.UUID(ticket_id))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")

    # Create message
    message = TicketMessage(
        ticket_id=ticket.id,
        message=data.message,
        sender_type=MessageSender.ADMIN.value,
        sender_name="Admin",
        is_internal=data.is_internal or False,
    )
    db.add(message)

    # Update ticket last_message_at
    ticket.last_message_at = datetime.utcnow()

    await db.commit()
    await db.refresh(message)

    # If not internal, notify participants
    if not data.is_internal:
        # Get participants
        participants_result = await db.execute(
            select(Artist)
            .join(TicketParticipant)
            .where(TicketParticipant.ticket_id == ticket.id)
        )
        participants = participants_result.scalars().all()

        # Create notifications
        for artist in participants:
            notification = Notification(
                notification_type=NotificationType.TICKET_MESSAGE.value,
                artist_id=artist.id,
                title=f"Nouveau message - {ticket.ticket_number}",
                message="Admin a répondu à votre ticket",
                data=json.dumps({
                    "ticket_id": str(ticket.id),
                    "ticket_number": ticket.ticket_number,
                }),
            )
            db.add(notification)

        await db.commit()

        # Send emails
        try:
            artist_emails = [a.email for a in participants if a.email]
            if artist_emails:
                ticket_url = f"https://artist.whalesrecords.com/support/{ticket.id}"
                await send_ticket_message_notification(
                    ticket_number=ticket.ticket_number,
                    subject=ticket.subject,
                    sender_name="Admin",
                    message=data.message,
                    recipient_emails=artist_emails,
                    ticket_url=ticket_url,
                )
        except Exception as e:
            logger.error(f"Failed to send message email: {e}")

    return {
        "id": str(message.id),
        "message": message.message,
        "sender_type": message.sender_type,
        "sender_name": message.sender_name,
        "is_internal": message.is_internal,
        "created_at": message.created_at.isoformat(),
    }


@router.delete("/{ticket_id}")
async def delete_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(verify_admin_token),
):
    """Delete a ticket (admin only)."""
    result = await db.execute(
        select(Ticket).where(Ticket.id == uuid.UUID(ticket_id))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")

    await db.delete(ticket)
    await db.commit()

    return {"message": "Ticket supprimé avec succès"}
