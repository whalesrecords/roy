"""Email service using Resend."""
import os
from typing import Optional, List
import resend


# Initialize Resend with API key from environment
resend.api_key = os.getenv("RESEND_API_KEY", "")

ADMIN_EMAIL = "royalties@whalesrecords.com"
FROM_EMAIL = "Whales Records <noreply@whalesrecords.com>"


async def send_email(
    to: str | List[str],
    subject: str,
    html: str,
    attachments: Optional[List[dict]] = None,
) -> bool:
    """
    Send an email using Resend.

    Args:
        to: Recipient email(s)
        subject: Email subject
        html: HTML content of the email
        attachments: Optional list of attachments with format:
            [{"filename": "file.pdf", "content": base64_string}]

    Returns:
        True if email was sent successfully
    """
    if not resend.api_key:
        print("Warning: RESEND_API_KEY not configured, email not sent")
        return False

    try:
        params = {
            "from": FROM_EMAIL,
            "to": [to] if isinstance(to, str) else to,
            "subject": subject,
            "html": html,
        }

        if attachments:
            params["attachments"] = attachments

        resend.Emails.send(params)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


async def send_payment_request_email(
    artist_name: str,
    artist_email: Optional[str],
    period_label: str,
    amount: str,
    currency: str,
    bank_details: Optional[dict] = None,
    contact_info: Optional[dict] = None,
    pdf_content: Optional[bytes] = None,
) -> bool:
    """
    Send a payment request email to the admin.

    Args:
        artist_name: Name of the artist
        artist_email: Artist's email for reply
        period_label: Period label (e.g., "Q3 2025")
        amount: Amount requested
        currency: Currency code
        bank_details: Optional bank details dict
        contact_info: Optional contact info dict
        pdf_content: Optional PDF attachment content

    Returns:
        True if email was sent successfully
    """
    # Build bank details section
    bank_section = ""
    if bank_details:
        bank_section = f"""
        <h3 style="color: #333; margin-top: 20px;">Coordonnees bancaires</h3>
        <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Titulaire:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{bank_details.get('account_holder', 'Non renseigne')}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Banque:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{bank_details.get('bank_name', 'Non renseigne')}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>IBAN:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{bank_details.get('iban', 'Non renseigne')}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>BIC:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{bank_details.get('bic', 'Non renseigne')}</td></tr>
        </table>
        """

    # Build contact section
    contact_section = ""
    if contact_info:
        address_parts = [
            contact_info.get('address_line1'),
            contact_info.get('address_line2'),
            f"{contact_info.get('postal_code', '')} {contact_info.get('city', '')}".strip(),
            contact_info.get('country'),
        ]
        address = "<br>".join([p for p in address_parts if p])

        contact_section = f"""
        <h3 style="color: #333; margin-top: 20px;">Coordonnees de l'artiste</h3>
        <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{contact_info.get('email', 'Non renseigne')}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Telephone:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{contact_info.get('phone', 'Non renseigne')}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Adresse:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{address or 'Non renseigne'}</td></tr>
        </table>
        """

    # Legal info section
    legal_section = ""
    if contact_info and (contact_info.get('siret') or contact_info.get('vat_number')):
        legal_section = f"""
        <h3 style="color: #333; margin-top: 20px;">Informations legales</h3>
        <table style="border-collapse: collapse; width: 100%;">
            {'<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>SIRET:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + contact_info.get('siret', '') + '</td></tr>' if contact_info.get('siret') else ''}
            {'<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>TVA:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + contact_info.get('vat_number', '') + '</td></tr>' if contact_info.get('vat_number') else ''}
        </table>
        """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Demande de paiement</h1>
        </div>

        <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333;">
                Hello there, it's <strong>{artist_name}</strong>!
            </p>

            <p style="font-size: 16px; color: #333;">
                Je souhaite recevoir le paiement de mes royalties pour la periode <strong>{period_label}</strong>.
            </p>

            <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ddd;">
                <p style="margin: 0; font-size: 24px; color: #667eea; font-weight: bold; text-align: center;">
                    {amount} {currency}
                </p>
            </div>

            {bank_section}
            {contact_section}
            {legal_section}

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; text-align: center;">
                Cet email a ete envoye automatiquement depuis l'Espace Artiste Whales Records.
                {f'<br>Repondre a: {artist_email}' if artist_email else ''}
            </p>
        </div>
    </body>
    </html>
    """

    attachments = None
    if pdf_content:
        import base64
        attachments = [{
            "filename": f"releve_{artist_name.replace(' ', '_')}_{period_label.replace(' ', '_')}.pdf",
            "content": base64.b64encode(pdf_content).decode('utf-8'),
        }]

    return await send_email(
        to=ADMIN_EMAIL,
        subject=f"Demande de paiement - {artist_name} - {period_label}",
        html=html,
        attachments=attachments,
    )


async def send_profile_update_notification(
    artist_name: str,
    artist_id: str,
    changed_fields: List[str],
) -> bool:
    """
    Send notification email when artist updates their profile.

    Args:
        artist_name: Name of the artist
        artist_id: Artist ID
        changed_fields: List of fields that were changed

    Returns:
        True if email was sent successfully
    """
    fields_list = "<li>" + "</li><li>".join(changed_fields) + "</li>"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f59e0b; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Mise a jour du profil artiste</h1>
        </div>

        <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333;">
                L'artiste <strong>{artist_name}</strong> a mis a jour son profil.
            </p>

            <h3 style="color: #333;">Champs modifies:</h3>
            <ul style="color: #666;">
                {fields_list}
            </ul>

            <p style="margin-top: 20px;">
                <a href="https://admin.whalesrecords.com/artists/{artist_id}"
                   style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Voir le profil
                </a>
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; text-align: center;">
                Cet email a ete envoye automatiquement depuis l'Espace Artiste Whales Records.
            </p>
        </div>
    </body>
    </html>
    """

    return await send_email(
        to=ADMIN_EMAIL,
        subject=f"Profil mis a jour - {artist_name}",
        html=html,
    )


async def send_ticket_created_notification(
    ticket_number: str,
    artist_name: str,
    subject: str,
    category: str,
    message: str,
    ticket_url: str,
) -> bool:
    """
    Send email to admin when artist creates a ticket.

    Args:
        ticket_number: Ticket number (e.g., TKT-001234)
        artist_name: Name of the artist
        subject: Ticket subject
        category: Ticket category
        message: First message content
        ticket_url: URL to view ticket in admin

    Returns:
        True if email was sent successfully
    """
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #3b82f6; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Nouveau ticket - {ticket_number}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333;">
                <strong>{artist_name}</strong> a cree un nouveau ticket de support.
            </p>

            <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <p style="margin: 0;"><strong>Categorie:</strong> {category}</p>
                <p style="margin: 10px 0 0 0;"><strong>Sujet:</strong> {subject}</p>
            </div>

            <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #666; white-space: pre-wrap;">{message}</p>
            </div>

            <p style="margin-top: 20px;">
                <a href="{ticket_url}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Voir le ticket
                </a>
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; text-align: center;">
                Cet email a ete envoye automatiquement depuis l'Espace Artiste Whales Records.
            </p>
        </div>
    </body>
    </html>
    """

    return await send_email(
        to=ADMIN_EMAIL,
        subject=f"Nouveau ticket - {ticket_number} - {artist_name}",
        html=html,
    )


async def send_ticket_message_notification(
    ticket_number: str,
    subject: str,
    sender_name: str,
    message: str,
    recipient_emails: List[str],
    ticket_url: str,
) -> bool:
    """
    Send email when new message is added to ticket.

    Args:
        ticket_number: Ticket number
        subject: Ticket subject
        sender_name: Name of message sender
        message: Message content
        recipient_emails: List of recipient emails
        ticket_url: URL to view ticket

    Returns:
        True if email was sent successfully
    """
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #10b981; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Nouveau message - {ticket_number}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333;">
                <strong>{sender_name}</strong> a repondu au ticket <strong>{ticket_number}</strong>
            </p>

            <p style="color: #666; font-size: 14px;">Sujet: {subject}</p>

            <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #666; white-space: pre-wrap;">{message}</p>
            </div>

            <p style="margin-top: 20px;">
                <a href="{ticket_url}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Repondre
                </a>
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; text-align: center;">
                Cet email a ete envoye automatiquement depuis l'Espace Artiste Whales Records.
            </p>
        </div>
    </body>
    </html>
    """

    return await send_email(
        to=recipient_emails,
        subject=f"Nouveau message - {ticket_number}",
        html=html,
    )


async def send_ticket_status_notification(
    ticket_number: str,
    subject: str,
    old_status: str,
    new_status: str,
    artist_emails: List[str],
    ticket_url: str,
) -> bool:
    """
    Send email when ticket status changes.

    Args:
        ticket_number: Ticket number
        subject: Ticket subject
        old_status: Previous status
        new_status: New status
        artist_emails: List of artist emails
        ticket_url: URL to view ticket

    Returns:
        True if email was sent successfully
    """
    status_labels = {
        "open": "Ouvert",
        "in_progress": "En cours",
        "resolved": "Resolu",
        "closed": "Ferme",
    }

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f59e0b; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Statut mis a jour - {ticket_number}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333;">
                Le statut de votre ticket a ete mis a jour.
            </p>

            <p style="color: #666; font-size: 14px;">Sujet: {subject}</p>

            <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;">
                    <span style="color: #999; text-decoration: line-through;">{status_labels.get(old_status, old_status)}</span>
                    →
                    <strong style="color: #10b981;">{status_labels.get(new_status, new_status)}</strong>
                </p>
            </div>

            <p style="margin-top: 20px;">
                <a href="{ticket_url}" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Voir le ticket
                </a>
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; text-align: center;">
                Cet email a ete envoye automatiquement depuis l'Espace Artiste Whales Records.
            </p>
        </div>
    </body>
    </html>
    """

    return await send_email(
        to=artist_emails,
        subject=f"Ticket {ticket_number} - {status_labels.get(new_status, new_status)}",
        html=html,
    )
