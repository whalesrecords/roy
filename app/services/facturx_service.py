"""Factur-X (self-billed royalty invoice) generation.

Produces a **PDF/A-3 with an embedded EN 16931 CII XML** (Factur-X, profil BASIC)
for a royalty statement, in the "autofacturation" model:

    Vendeur (seller)  = l'artiste   (SIRET / TVA / adresse du profil artiste)
    Acheteur (buyer)  = le label    (Whales — label_settings)
    Montant           = net à payer du relevé (net_payable)

TVA par défaut : **non applicable (art. 293 B du CGI)** si l'artiste n'a pas de
numéro de TVA (cas auto-entrepreneur en franchise). Un taux peut être imposé via
``vat_rate`` (endpoint) ; les montants et le XML CII s'adaptent alors.

Design notes:
- The human-readable PDF is rendered with reportlab (always works).
- The CII XML is hand-built for the BASIC profile; ``factur-x`` validates it
  against the XSD when embedding, so a malformed XML surfaces as a clear error
  rather than a silently non-compliant file.
- ``factur-x`` / ``lxml`` are imported lazily so a packaging issue can only ever
  affect this one endpoint, never the app boot.
"""
from __future__ import annotations

import io
import logging
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from xml.sax.saxutils import escape

logger = logging.getLogger(__name__)

FACTURX_LEVEL = "basic"  # profil Factur-X (minimum d'infos structurées conforme)
FACTURX_XML_NAME = "factur-x.xml"


def _money(value) -> str:
    """Format a monetary amount to 2 decimals (Factur-X requires fixed scale)."""
    return str(Decimal(value or 0).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _pct(value) -> str:
    return str(Decimal(value or 0).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _country_code(country: str | None) -> str:
    """Best-effort ISO-3166 alpha-2 code from a free-text country (defaults FR)."""
    if not country:
        return "FR"
    c = country.strip().lower()
    mapping = {
        "france": "FR", "fr": "FR", "belgique": "BE", "belgium": "BE",
        "suisse": "CH", "switzerland": "CH", "allemagne": "DE", "germany": "DE",
        "espagne": "ES", "spain": "ES", "italie": "IT", "italy": "IT",
        "royaume-uni": "GB", "uk": "GB", "united kingdom": "GB",
        "états-unis": "US", "etats-unis": "US", "usa": "US", "united states": "US",
        "canada": "CA", "pays-bas": "NL", "netherlands": "NL", "portugal": "PT",
    }
    if c in mapping:
        return mapping[c]
    if len(c) == 2:
        return c.upper()
    return "FR"


def build_invoice_context(statement, profile, label, invoice_number: str, vat_rate: Decimal) -> dict:
    """Assemble every value needed by the PDF + CII XML from ORM objects.

    ``statement`` : Statement · ``profile`` : ArtistProfile (may be None) ·
    ``label`` : LabelSettings (may be None) · ``vat_rate`` : Decimal percent (e.g. 0 or 20).
    """
    artist_name = getattr(getattr(statement, "artist", None), "name", None) or "Artiste"
    total_ht = Decimal(statement.net_payable or 0).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    rate = Decimal(vat_rate or 0)
    vat_amount = (total_ht * rate / Decimal(100)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total_ttc = (total_ht + vat_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    seller_vat = (getattr(profile, "vat_number", None) or "").strip() if profile else ""
    exempt = rate == 0
    # Category code: E = exonéré (franchise/293 B), S = taux normal.
    category = "E" if exempt else "S"
    exemption_reason = "TVA non applicable, art. 293 B du CGI" if (exempt and not seller_vat) else (
        "Exonération de TVA" if exempt else ""
    )

    def _addr(obj):
        return {
            "line1": (getattr(obj, "address_line1", None) or "").strip(),
            "zip": (getattr(obj, "postal_code", None) or "").strip(),
            "city": (getattr(obj, "city", None) or "").strip(),
            "country": _country_code(getattr(obj, "country", None)),
        }

    return {
        "invoice_number": invoice_number,
        "issue_date": datetime.utcnow(),
        "currency": (statement.currency or "EUR")[:3].upper(),
        "period_start": statement.period_start,
        "period_end": statement.period_end,
        "line_name": f"Redevances / droits — période du {statement.period_start} au {statement.period_end}",
        "seller": {
            "name": artist_name,
            "siret": (getattr(profile, "siret", None) or "").strip() if profile else "",
            "vat": seller_vat,
            "iban": (getattr(profile, "iban", None) or "").strip() if profile else "",
            "bic": (getattr(profile, "bic", None) or "").strip() if profile else "",
            "email": (getattr(profile, "email", None) or "").strip() if profile else "",
            **(_addr(profile) if profile else {"line1": "", "zip": "", "city": "", "country": "FR"}),
        },
        "buyer": {
            "name": (getattr(label, "label_name", None) or "Whales Records") if label else "Whales Records",
            "siret": (getattr(label, "siret", None) or "").strip() if label else "",
            "vat": (getattr(label, "vat_number", None) or "").strip() if label else "",
            "email": (getattr(label, "email", None) or "").strip() if label else "",
            **(_addr(label) if label else {"line1": "", "zip": "", "city": "", "country": "FR"}),
        },
        "rate": rate,
        "category": category,
        "exemption_reason": exemption_reason,
        "total_ht": total_ht,
        "vat_amount": vat_amount,
        "total_ttc": total_ttc,
    }


# ── CII XML (BASIC profile) ───────────────────────────────────────────
def build_cii_xml(inv: dict) -> bytes:
    def _tax_reg(party):
        blocks = ""
        if party.get("vat"):
            blocks += f'<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">{escape(party["vat"])}</ram:ID></ram:SpecifiedTaxRegistration>'
        if party.get("siret"):
            blocks += f'<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">{escape(party["siret"])}</ram:ID></ram:SpecifiedTaxRegistration>'
        return blocks

    def _party(party):
        return (
            f"<ram:Name>{escape(party['name'])}</ram:Name>"
            "<ram:PostalTradeAddress>"
            + (f"<ram:PostcodeCode>{escape(party['zip'])}</ram:PostcodeCode>" if party.get("zip") else "")
            + (f"<ram:LineOne>{escape(party['line1'])}</ram:LineOne>" if party.get("line1") else "")
            + (f"<ram:CityName>{escape(party['city'])}</ram:CityName>" if party.get("city") else "")
            + f"<ram:CountryID>{escape(party['country'])}</ram:CountryID>"
            "</ram:PostalTradeAddress>"
            + _tax_reg(party)
        )

    rate = _pct(inv["rate"])
    cat = inv["category"]
    currency = inv["currency"]
    exemption = f"<ram:ExemptionReason>{escape(inv['exemption_reason'])}</ram:ExemptionReason>" if inv["exemption_reason"] else ""
    issue = inv["issue_date"].strftime("%Y%m%d")

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>{escape(inv['invoice_number'])}</ram:ID>
    <ram:TypeCode>389</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">{issue}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>1</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>{escape(inv['line_name'])}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>{_money(inv['total_ht'])}</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">1</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>{cat}</ram:CategoryCode>
          <ram:RateApplicablePercent>{rate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>{_money(inv['total_ht'])}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>{_party(inv['seller'])}</ram:SellerTradeParty>
      <ram:BuyerTradeParty>{_party(inv['buyer'])}</ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>{currency}</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>{_money(inv['vat_amount'])}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        {exemption}
        <ram:BasisAmount>{_money(inv['total_ht'])}</ram:BasisAmount>
        <ram:CategoryCode>{cat}</ram:CategoryCode>
        <ram:RateApplicablePercent>{rate}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>{_money(inv['total_ht'])}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>{_money(inv['total_ht'])}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="{currency}">{_money(inv['vat_amount'])}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>{_money(inv['total_ttc'])}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>{_money(inv['total_ttc'])}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>"""
    return xml.encode("utf-8")


# ── Human-readable PDF (reportlab) ────────────────────────────────────
def render_invoice_pdf(inv: dict) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    x = 20 * mm
    y = h - 25 * mm

    def line(txt, dy=5.2 * mm, font="Helvetica", size=9, color=colors.black):
        nonlocal y
        c.setFillColor(color)
        c.setFont(font, size)
        c.drawString(x, y, txt)
        y -= dy

    c.setFont("Helvetica-Bold", 16)
    c.drawString(x, y, "FACTURE (autofacturation)")
    y -= 8 * mm
    line(f"N° {inv['invoice_number']}", font="Helvetica-Bold", size=10)
    line(f"Date : {inv['issue_date'].strftime('%d/%m/%Y')}")
    line(f"Période : du {inv['period_start']} au {inv['period_end']}")
    y -= 3 * mm

    # Parties
    s, b = inv["seller"], inv["buyer"]
    col2 = x + 92 * mm
    top = y
    c.setFont("Helvetica-Bold", 9); c.drawString(x, y, "Vendeur (artiste)")
    c.drawString(col2, y, "Acheteur (label)"); y -= 5 * mm
    c.setFont("Helvetica", 8.5)

    def party_block(px, p):
        yy = top - 5 * mm
        for txt in [
            p["name"],
            p.get("line1", ""),
            f"{p.get('zip','')} {p.get('city','')}".strip(),
            p.get("country", ""),
            f"SIRET : {p['siret']}" if p.get("siret") else "",
            f"TVA : {p['vat']}" if p.get("vat") else "",
            p.get("email", ""),
        ]:
            if txt:
                c.drawString(px, yy, txt[:60]); yy -= 4.6 * mm
        return yy

    y_left = party_block(x, s)
    y_right = party_block(col2, b)
    y = min(y_left, y_right) - 6 * mm

    # Amounts table
    c.setFillColor(colors.HexColor("#F1F3F5"))
    c.rect(x, y - 2 * mm, w - 2 * x, 8 * mm, fill=1, stroke=0)
    c.setFillColor(colors.black); c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 2 * mm, y, "Désignation")
    c.drawRightString(w - x - 2 * mm, y, f"Montant HT ({inv['currency']})")
    y -= 8 * mm
    c.setFont("Helvetica", 9)
    c.drawString(x + 2 * mm, y, inv["line_name"][:70])
    c.drawRightString(w - x - 2 * mm, y, _money(inv["total_ht"]))
    y -= 8 * mm

    c.setFont("Helvetica", 9)
    c.drawRightString(w - x - 40 * mm, y, "Total HT :"); c.drawRightString(w - x - 2 * mm, y, _money(inv["total_ht"])); y -= 5.5 * mm
    vat_label = f"TVA ({_pct(inv['rate'])} %) :" if inv["rate"] else "TVA :"
    c.drawRightString(w - x - 40 * mm, y, vat_label); c.drawRightString(w - x - 2 * mm, y, _money(inv["vat_amount"])); y -= 5.5 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(w - x - 40 * mm, y, "Total à payer :"); c.drawRightString(w - x - 2 * mm, y, f"{_money(inv['total_ttc'])} {inv['currency']}"); y -= 9 * mm

    c.setFont("Helvetica-Oblique", 8)
    if inv["exemption_reason"]:
        c.setFillColor(colors.HexColor("#555555")); c.drawString(x, y, inv["exemption_reason"]); y -= 5 * mm
    if s.get("iban"):
        c.setFillColor(colors.HexColor("#555555"))
        c.drawString(x, y, f"Règlement par virement — IBAN {s['iban']}" + (f" · BIC {s['bic']}" if s.get("bic") else "")); y -= 5 * mm
    c.setFillColor(colors.HexColor("#999999")); c.setFont("Helvetica", 7)
    c.drawString(x, 15 * mm, "Facture électronique Factur-X (profil BASIC · EN 16931) — XML CII intégré.")

    c.showPage()
    c.save()
    return buf.getvalue()


# ── Assemble Factur-X (PDF/A-3 + embedded CII) ────────────────────────
def generate_facturx_pdf(inv: dict) -> bytes:
    """Render the invoice PDF, build the CII XML, embed → PDF/A-3 Factur-X bytes."""
    pdf_bytes = render_invoice_pdf(inv)
    xml_bytes = build_cii_xml(inv)

    # Import lazily so a packaging problem only ever affects this endpoint.
    try:
        from facturx import generate_from_binary as _generate
    except ImportError:  # older API name
        from facturx import generate_facturx_from_binary as _generate

    result = _generate(
        pdf_bytes,
        xml_bytes,
        flavor="factur-x",
        level=FACTURX_LEVEL,
        check_xsd=True,
    )
    # Some versions return bytes, others a file-like/str path — normalise to bytes.
    if isinstance(result, bytes):
        return result
    if hasattr(result, "read"):
        return result.read()
    with open(result, "rb") as fh:  # pragma: no cover — path-returning fallback
        return fh.read()
