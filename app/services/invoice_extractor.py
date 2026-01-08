"""
Invoice extraction service.

Extracts data from PDF invoices using:
1. Filename parsing (date, category, artist from naming convention)
2. PDF text extraction (pypdf)
3. AI parsing for amounts and details (Claude API via httpx)
"""

import io
import os
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Optional
import json

import httpx
from pypdf import PdfReader

# Category mapping from filename conventions to system categories
CATEGORY_MAPPING = {
    "mastering": "mastering",
    "mixing": "mixing",
    "recording": "recording",
    "press": "pr",
    "pr": "pr",
    "marketing": "advertising",
    "ads": "advertising",
    "advertising": "advertising",
    "photos": "photos",
    "photo": "photos",
    "video": "video",
    "artwork": "artwork",
    "design": "artwork",
    "cd": "cd",
    "vinyl": "vinyl",
    "goodies": "goodies",
    "merch": "goodies",
    "distribution": "distribution",
    "distrib": "distribution",
    "groover": "groover",
    "submithub": "submithub",
    "compo": "other",
    "composition": "other",
}


@dataclass
class FilenameData:
    """Data extracted from invoice filename."""
    date: Optional[date] = None
    category: Optional[str] = None
    artist: Optional[str] = None
    details: Optional[str] = None


@dataclass
class ExtractedInvoice:
    """Complete extracted invoice data."""
    filename: str
    # From filename
    date_from_filename: Optional[str] = None
    category_from_filename: Optional[str] = None
    artist_from_filename: Optional[str] = None
    # From PDF content
    invoice_number: Optional[str] = None
    vendor_name: Optional[str] = None
    total_amount: Optional[str] = None
    currency: str = "EUR"
    album_or_track: Optional[str] = None
    description: Optional[str] = None
    # Raw data
    raw_text: str = ""
    document_base64: Optional[str] = None
    # Confidence
    confidence_score: float = 0.0
    warnings: list = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


def parse_filename(filename: str) -> FilenameData:
    """
    Parse invoice filename to extract date, category, and artist.

    Expected format: YYYYMMDD_Category_Artist_Details.pdf
    Examples:
        - 20210304_Mastering_Francesca Gaza.pdf
        - 20210916_Press_Aiko Aiko.pdf
        - 20230726_Marketing_mix AINO MURIEL JULIEN.pdf
    """
    result = FilenameData()

    # Remove extension
    name = filename.rsplit(".", 1)[0] if "." in filename else filename

    # Try to extract date (YYYYMMDD at start)
    date_match = re.match(r"^(\d{8})_", name)
    if date_match:
        try:
            date_str = date_match.group(1)
            result.date = date(
                int(date_str[:4]),
                int(date_str[4:6]),
                int(date_str[6:8])
            )
            name = name[9:]  # Remove date and underscore
        except ValueError:
            pass

    # Split remaining by underscore
    parts = name.split("_", 2)  # Max 3 parts: category, artist, details

    if len(parts) >= 1:
        # First part is category
        category_raw = parts[0].lower().strip()
        result.category = CATEGORY_MAPPING.get(category_raw, "other")

    if len(parts) >= 2:
        # Second part is artist (may contain extra info)
        artist_raw = parts[1].strip()
        # Clean up common patterns like "(ne pas compter)" or numbers
        artist_clean = re.sub(r"\s*\(.*?\)\s*", "", artist_raw)
        artist_clean = re.sub(r"_\d+$", "", artist_clean)  # Remove trailing numbers
        result.artist = artist_clean.strip()

    if len(parts) >= 3:
        result.details = parts[2].strip()

    return result


def extract_pdf_text(content: bytes) -> str:
    """
    Extract text from PDF file content.

    Args:
        content: PDF file as bytes

    Returns:
        Extracted text string
    """
    try:
        reader = PdfReader(io.BytesIO(content))
        texts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                texts.append(text)
        return "\n\n".join(texts)
    except Exception as e:
        return f"[Error extracting PDF text: {str(e)}]"


async def parse_invoice_with_ai(
    raw_text: str,
    filename_hints: FilenameData,
    api_key: Optional[str] = None
) -> dict:
    """
    Parse invoice text using Claude AI to extract structured data.

    Args:
        raw_text: Text extracted from PDF
        filename_hints: Data already extracted from filename
        api_key: Anthropic API key (defaults to env var)

    Returns:
        Dictionary with extracted fields
    """
    api_key = api_key or os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        # Fallback: try to extract amount with regex
        return _extract_amount_regex(raw_text)

    if not raw_text or len(raw_text.strip()) < 10:
        return {"error": "Texte trop court"}

    system_prompt = """Tu es un assistant qui extrait des informations de factures pour un label musical.

Analyse le texte de la facture et retourne UNIQUEMENT un JSON valide avec ces champs:
{
  "invoice_number": "numéro de facture ou null",
  "vendor_name": "nom du fournisseur/prestataire ou null",
  "total_amount": "montant total TTC en string (ex: '300.00') ou null",
  "currency": "EUR, USD, GBP ou PLN",
  "album_or_track": "nom de l'album ou track mentionné ou null",
  "description": "description courte du service ou null",
  "confidence": 0.8
}

Règles:
- Cherche le montant TOTAL (TTC si TVA mentionnée)
- Pour les devises: EUR par défaut, sinon détecte $, £, PLN, etc.
- confidence: 0.0 à 1.0 selon la clarté du texte"""

    hints_text = ""
    if filename_hints.artist:
        hints_text += f"\nArtiste probable: {filename_hints.artist}"
    if filename_hints.category:
        hints_text += f"\nCatégorie: {filename_hints.category}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": 512,
                    "system": system_prompt,
                    "messages": [
                        {
                            "role": "user",
                            "content": f"Voici le texte de la facture:{hints_text}\n\n{raw_text[:3000]}"
                        }
                    ]
                }
            )

            if response.status_code != 200:
                return _extract_amount_regex(raw_text)

            data = response.json()
            content = data["content"][0]["text"]

            # Parse JSON from response
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            return json.loads(content.strip())

    except Exception as e:
        # Fallback to regex
        result = _extract_amount_regex(raw_text)
        result["ai_error"] = str(e)
        return result


def _extract_amount_regex(text: str) -> dict:
    """
    Fallback: extract amount using regex patterns.
    """
    result = {
        "total_amount": None,
        "currency": "EUR",
        "confidence": 0.3,
    }

    # Common patterns for totals
    patterns = [
        # "Total: 300,- Euro" or "Total: 300.00 EUR"
        r"[Tt]otal[:\s]+([0-9.,]+)[\s,-]*(?:Euro|EUR|€)",
        # "765,60 EUR" standalone
        r"([0-9]+[.,][0-9]{2})\s*(?:EUR|€)",
        # "Grand total: 765.60 EUR"
        r"[Gg]rand\s+[Tt]otal[:\s]+([0-9.,]+)\s*(?:EUR|€)",
        # "Do zapłaty: 765,60 EUR" (Polish)
        r"[Dd]o\s+zapłaty[:\s]+([0-9.,]+)\s*(?:EUR|€)",
        # Generic amount with Euro
        r"([0-9]+[.,]?[0-9]*)\s*(?:Euro|EUR|€)",
    ]

    amounts = []
    for pattern in patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            # Normalize number format
            amount_str = match.replace(",", ".").replace(" ", "")
            try:
                amount = float(amount_str)
                if amount > 0:
                    amounts.append(amount)
            except ValueError:
                pass

    if amounts:
        # Take the largest amount (likely the total)
        result["total_amount"] = f"{max(amounts):.2f}"
        result["confidence"] = 0.5

    # Try to detect currency
    if "$" in text or "USD" in text:
        result["currency"] = "USD"
    elif "£" in text or "GBP" in text:
        result["currency"] = "GBP"
    elif "PLN" in text or "zł" in text:
        result["currency"] = "EUR"  # Keep EUR, PLN invoices often show EUR equivalent

    return result


async def extract_invoice_data(
    content: bytes,
    filename: str,
    api_key: Optional[str] = None
) -> ExtractedInvoice:
    """
    Main function to extract all data from an invoice file.

    Args:
        content: File content as bytes
        filename: Original filename
        api_key: Optional Anthropic API key

    Returns:
        ExtractedInvoice with all extracted data
    """
    result = ExtractedInvoice(filename=filename)

    # 1. Parse filename
    filename_data = parse_filename(filename)
    if filename_data.date:
        result.date_from_filename = filename_data.date.isoformat()
    result.category_from_filename = filename_data.category
    result.artist_from_filename = filename_data.artist

    # 2. Extract PDF text
    if filename.lower().endswith(".pdf"):
        result.raw_text = extract_pdf_text(content)
    else:
        result.raw_text = "[Image file - OCR not implemented]"
        result.warnings.append("Les fichiers image nécessitent OCR (non implémenté)")

    # 3. Parse with AI or regex
    if result.raw_text and not result.raw_text.startswith("["):
        ai_result = await parse_invoice_with_ai(
            result.raw_text,
            filename_data,
            api_key
        )

        result.invoice_number = ai_result.get("invoice_number")
        result.vendor_name = ai_result.get("vendor_name")
        result.total_amount = ai_result.get("total_amount")
        result.currency = ai_result.get("currency", "EUR")
        result.album_or_track = ai_result.get("album_or_track")
        result.description = ai_result.get("description")
        result.confidence_score = ai_result.get("confidence", 0.5)

        if ai_result.get("ai_error"):
            result.warnings.append(f"Extraction IA indisponible: {ai_result['ai_error']}")

    return result
