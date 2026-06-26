"""Build the legal evidence for a simple electronic signature (eIDAS art. 25):
a deterministic hash of the signed contract, and a signature certificate PDF
bundling the drawn signature with the audit trail.
"""
import base64
import hashlib
import json
import logging
from io import BytesIO
from typing import Optional

logger = logging.getLogger(__name__)


def compute_document_hash(contract: dict, parties: list[dict]) -> str:
    """Deterministic SHA-256 of the contract content at signing time."""
    snapshot = {
        "id": str(contract.get("id")),
        "scope": contract.get("scope"),
        "scope_id": contract.get("scope_id"),
        "start_date": str(contract.get("start_date")),
        "end_date": str(contract.get("end_date")),
        "description": contract.get("description"),
        "parties": sorted(
            [
                {
                    "type": p.get("party_type"),
                    "artist_id": str(p.get("artist_id")) if p.get("artist_id") else None,
                    "label_name": p.get("label_name"),
                    "share": str(p.get("share_percentage")),
                    "share_physical": str(p.get("share_physical")),
                    "share_digital": str(p.get("share_digital")),
                }
                for p in parties
            ],
            key=lambda x: (x["type"] or "", x["artist_id"] or "", x["label_name"] or ""),
        ),
    }
    canonical = json.dumps(snapshot, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _decode_signature_png(data: Optional[str]) -> Optional[bytes]:
    if not data:
        return None
    try:
        if "," in data and data.strip().startswith("data:"):
            data = data.split(",", 1)[1]
        return base64.b64decode(data)
    except Exception:  # noqa: BLE001
        return None


def build_certificate_pdf(
    *,
    contract: dict,
    parties: list[dict],
    signer: dict,
    audit: dict,
    signature_png_b64: Optional[str],
) -> Optional[str]:
    """Return a base64-encoded PDF certificate, or None if generation fails."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib.utils import ImageReader
        from reportlab.pdfgen import canvas
    except Exception as e:  # noqa: BLE001 — reportlab not available
        logger.warning(f"reportlab unavailable, skipping certificate PDF: {e}")
        return None

    try:
        buf = BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        w, h = A4
        x = 20 * mm
        y = h - 25 * mm

        def line(txt: str, *, size: int = 10, dy: float = 6 * mm, bold: bool = False, color=(0.1, 0.1, 0.1)):
            nonlocal y
            c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
            c.setFillColorRGB(*color)
            c.drawString(x, y, txt[:110])
            y -= dy

        line("Certificat de signature electronique", size=16, dy=10 * mm, bold=True)
        line("Signature electronique simple - eIDAS (Reglement UE 910/2014, art. 25)", size=9, dy=9 * mm, color=(0.4, 0.4, 0.4))

        line("CONTRAT", size=11, bold=True)
        line(f"Reference : {contract.get('id')}")
        line(f"Perimetre : {contract.get('scope')}" + (f" / {contract.get('scope_id')}" if contract.get("scope_id") else ""))
        line(f"Periode : {contract.get('start_date')} -> {contract.get('end_date') or 'sans echeance'}")
        if contract.get("description"):
            line(f"Description : {contract.get('description')}")

        line("PARTIES", size=11, bold=True, dy=7 * mm)
        for p in parties:
            who = p.get("label_name") or (str(p.get("artist_id")) if p.get("artist_id") else p.get("party_type"))
            line(f" - {p.get('party_type')}: {who} ({p.get('share_percentage')})", size=9, dy=5 * mm)

        line("SIGNATAIRE", size=11, bold=True, dy=7 * mm)
        line(f"Nom : {signer.get('name')}")
        if signer.get("email"):
            line(f"Email : {signer.get('email')}")
        line(f"Identifiant artiste : {signer.get('artist_id')}")

        # Drawn signature
        png = _decode_signature_png(signature_png_b64)
        if png:
            try:
                img = ImageReader(BytesIO(png))
                iw, ih = img.getSize()
                draw_w = 70 * mm
                draw_h = draw_w * (ih / iw) if iw else 30 * mm
                if draw_h > 40 * mm:
                    draw_h = 40 * mm
                    draw_w = draw_h * (iw / ih) if ih else 70 * mm
                y -= 2 * mm
                c.setStrokeColorRGB(0.8, 0.8, 0.8)
                c.rect(x, y - draw_h, draw_w, draw_h, stroke=1, fill=0)
                c.drawImage(img, x + 2, y - draw_h + 2, width=draw_w - 4, height=draw_h - 4, mask="auto", preserveAspectRatio=True)
                y -= draw_h + 6 * mm
            except Exception:  # noqa: BLE001
                pass

        line("PREUVE", size=11, bold=True, dy=7 * mm)
        line(f"Date (UTC) : {audit.get('signed_at')}", size=9, dy=5 * mm)
        line(f"Adresse IP : {audit.get('ip_address') or '-'}", size=9, dy=5 * mm)
        line(f"Appareil : {(audit.get('user_agent') or '-')[:90]}", size=9, dy=5 * mm)
        line(f"Empreinte du document (SHA-256) : {audit.get('document_hash')}", size=8, dy=5 * mm, color=(0.4, 0.4, 0.4))
        line("Consentement explicite recueilli au moment de la signature.", size=8, dy=5 * mm, color=(0.4, 0.4, 0.4))

        c.showPage()
        c.save()
        return base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Certificate PDF generation failed: {e}")
        return None
