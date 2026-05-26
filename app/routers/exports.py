"""
Exports Router

Generates CSV and PDF exports for royalty reports, transactions, and expenses.
"""

import csv
import io
import logging
from datetime import date
from decimal import Decimal
from typing import Annotated, Optional
from uuid import UUID as PyUUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import String as SAString
from sqlalchemy import and_, cast, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.models.advance_ledger import AdvanceLedgerEntry, ExpenseCategory, LedgerEntryType
from app.models.artist import Artist
from app.models.contract import Contract, ContractScope
from app.models.contract_party import ContractParty as ContractPartyModel
from app.models.import_model import Import
from app.models.label_settings import LabelSettings
from app.models.track_artist_link import TrackArtistLink
from app.models.transaction import TransactionNormalized

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/exports", tags=["exports"])


async def verify_admin_token(
    x_admin_token: Annotated[str, Header()],
) -> str:
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return x_admin_token


def _fmt(val: Decimal) -> str:
    """Format decimal to 2 decimal places."""
    return str(round(val, 2))


def _pct(val: Decimal) -> str:
    """Format decimal share (0-1) as percentage string."""
    return str(round(val * 100, 2))


async def _compute_all_artists_royalties(
    db: AsyncSession,
    period_start: date,
    period_end: date,
) -> list[dict]:
    """
    Compute royalties for ALL signed artists in a period.
    Returns a flat list of rows: one per artist per UPC.
    """
    # Get all signed artists
    result = await db.execute(
        select(Artist).where(
            or_(Artist.category == "signed", Artist.category.is_(None))
        ).order_by(Artist.name)
    )
    artists = result.scalars().all()

    rows = []

    for artist in artists:
        # Get contracts for this artist (valid in the period)
        validity_condition = and_(
            Contract.start_date <= period_end,
            or_(
                Contract.end_date.is_(None),
                Contract.end_date >= period_start,
            ),
        )
        contract_result = await db.execute(
            select(Contract).options(selectinload(Contract.parties)).where(
                or_(
                    Contract.artist_id == artist.id,
                    Contract.id.in_(
                        select(ContractPartyModel.contract_id).where(
                            ContractPartyModel.artist_id == artist.id
                        )
                    )
                ),
                validity_condition,
            )
        )
        contracts = contract_result.unique().scalars().all()

        track_contracts = {c.scope_id: c for c in contracts if c.scope == ContractScope.TRACK and c.scope_id}
        release_contracts = {c.scope_id: c for c in contracts if c.scope == ContractScope.RELEASE and c.scope_id}
        catalog_contract = next((c for c in contracts if c.scope == ContractScope.CATALOG), None)

        # Get track-artist links
        links_result = await db.execute(
            select(TrackArtistLink).where(TrackArtistLink.artist_id == artist.id)
        )
        artist_links = links_result.scalars().all()
        linked_isrcs = {link.isrc for link in artist_links}

        # Get transactions
        tx_result = await db.execute(
            select(
                TransactionNormalized.release_title,
                TransactionNormalized.upc,
                TransactionNormalized.isrc,
                TransactionNormalized.gross_amount,
                TransactionNormalized.quantity,
                TransactionNormalized.physical_format,
                Import.source,
            )
            .join(Import, TransactionNormalized.import_id == Import.id)
            .where(
                or_(
                    func.lower(TransactionNormalized.artist_name) == artist.name.lower(),
                    TransactionNormalized.isrc.in_(linked_isrcs) if linked_isrcs else False,
                ),
                TransactionNormalized.period_start >= period_start,
                TransactionNormalized.period_end <= period_end,
            )
        )
        transactions = tx_result.all()

        if not transactions:
            continue

        # Build UPC mappings — prefer authoritative sources (TuneCore/Believe/CDBaby)
        authoritative_sources = {"tunecore", "believe", "believe_uk", "believe_fr", "cdbaby"}
        release_title_to_upc: dict[str, str] = {}
        release_title_upc_source: dict[str, str] = {}
        isrc_to_upc: dict[str, str] = {}
        for tx in transactions:
            if tx.upc and tx.release_title:
                key = tx.release_title.strip().lower()
                tx_source = (tx.source.value if hasattr(tx.source, 'value') else tx.source).lower() if tx.source else "other"
                existing_source = release_title_upc_source.get(key)
                is_auth = tx_source in authoritative_sources
                existing_is_auth = existing_source in authoritative_sources if existing_source else False
                if key not in release_title_to_upc or (is_auth and not existing_is_auth):
                    release_title_to_upc[key] = tx.upc
                    release_title_upc_source[key] = tx_source
            if tx.upc and tx.isrc:
                if tx.isrc not in isrc_to_upc:
                    isrc_to_upc[tx.isrc] = tx.upc

        # Source type helpers
        stream_sources = {"tunecore", "believe", "believe_uk", "believe_fr", "cdbaby"}

        def get_sale_type(source: str, physical_format: str | None) -> str:
            if source in stream_sources:
                return "stream"
            fmt = (physical_format or "").lower().strip()
            if "vinyl" in fmt or "lp" in fmt:
                return "vinyl"
            if "cd" in fmt:
                return "cd"
            if "k7" in fmt or "cassette" in fmt or "tape" in fmt:
                return "k7"
            if "digital" in fmt or "download" in fmt:
                return "digital"
            return "digital"

        def _pick_share(party, st: str) -> Decimal:
            if st in ("cd", "vinyl", "k7", "physical") and party.share_physical is not None:
                return party.share_physical
            if st == "digital" and party.share_digital is not None:
                return party.share_digital
            return party.share_percentage

        # Aggregate by UPC
        albums: dict[str, dict] = {}
        for tx in transactions:
            source = (tx.source.value if hasattr(tx.source, 'value') else tx.source).lower() if tx.source else "other"
            title_key = tx.release_title.strip().lower() if tx.release_title else None
            auth_upc = release_title_to_upc.get(title_key) if title_key else None
            auth_src = release_title_upc_source.get(title_key) if title_key else None

            if source not in authoritative_sources and auth_upc and auth_src in authoritative_sources:
                upc = auth_upc
            else:
                upc = tx.upc
                if not upc and tx.isrc:
                    upc = isrc_to_upc.get(tx.isrc)
                if not upc and title_key:
                    upc = release_title_to_upc.get(title_key)
            upc = upc or "UNKNOWN"
            amount = tx.gross_amount or Decimal("0")

            if upc not in albums:
                albums[upc] = {
                    "release_title": tx.release_title or "(Sans album)",
                    "upc": upc,
                    "gross": Decimal("0"),
                    "artist_royalties": Decimal("0"),
                    "label_royalties": Decimal("0"),
                    "streams": 0,
                    "artist_share": Decimal("0"),
                    "tx_count": 0,
                }

            album = albums[upc]
            album["gross"] += amount
            album["streams"] += tx.quantity or 0
            album["tx_count"] += 1

            # Find contract
            contract = None
            if tx.isrc and tx.isrc in track_contracts:
                contract = track_contracts[tx.isrc]
            elif upc in release_contracts:
                contract = release_contracts[upc]
            elif catalog_contract:
                contract = catalog_contract

            sale_type = get_sale_type(source, tx.physical_format)

            if contract:
                this_artist_party = None
                if contract.parties:
                    for p in contract.parties:
                        if p.party_type == "artist" and p.artist_id == artist.id:
                            this_artist_party = p
                            break
                if this_artist_party:
                    artist_share = _pick_share(this_artist_party, sale_type)
                else:
                    artist_share = contract.artist_share
                label_share = contract.label_share
            else:
                artist_share = Decimal("0.5")
                label_share = Decimal("0.5")

            album["artist_royalties"] += amount * artist_share
            album["label_royalties"] += amount * label_share
            # Store last seen share for display (weighted average would be complex)
            album["artist_share"] = artist_share

        # Get advances
        advances_result = await db.execute(
            select(
                func.coalesce(func.sum(AdvanceLedgerEntry.amount), Decimal("0"))
            ).where(
                AdvanceLedgerEntry.artist_id == artist.id,
                AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE,
            )
        )
        total_advances = advances_result.scalar() or Decimal("0")

        recoup_result = await db.execute(
            select(
                func.coalesce(func.sum(AdvanceLedgerEntry.amount), Decimal("0"))
            ).where(
                AdvanceLedgerEntry.artist_id == artist.id,
                AdvanceLedgerEntry.entry_type == LedgerEntryType.RECOUPMENT,
            )
        )
        total_recouped = recoup_result.scalar() or Decimal("0")
        advance_balance = total_advances - total_recouped

        # Total for this artist
        artist_total_gross = sum(a["gross"] for a in albums.values())
        artist_total_royalties = sum(a["artist_royalties"] for a in albums.values())

        # Recoupment
        recoupable = min(artist_total_royalties, max(advance_balance, Decimal("0")))
        net_payable = artist_total_royalties - recoupable

        # Add rows
        for upc, album in sorted(albums.items(), key=lambda x: x[1]["gross"], reverse=True):
            rows.append({
                "artist_name": artist.name,
                "release_title": album["release_title"],
                "upc": album["upc"],
                "gross": album["gross"],
                "artist_share_pct": album["artist_share"],
                "artist_royalties": album["artist_royalties"],
                "label_royalties": album["label_royalties"],
                "streams": album["streams"],
            })

        # Add artist total row
        rows.append({
            "artist_name": artist.name,
            "release_title": "TOTAL",
            "upc": "",
            "gross": artist_total_gross,
            "artist_share_pct": Decimal("0"),
            "artist_royalties": artist_total_royalties,
            "label_royalties": sum(a["label_royalties"] for a in albums.values()),
            "streams": sum(a["streams"] for a in albums.values()),
            "advance_balance": advance_balance,
            "recoupable": recoupable,
            "net_payable": net_payable,
        })

    return rows


@router.get("/royalties/csv")
async def export_royalties_csv(
    period_start: date,
    period_end: date,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
):
    """Export royalties for all artists as CSV."""
    rows = await _compute_all_artists_royalties(db, period_start, period_end)

    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')

    # Header
    writer.writerow([
        "Artiste",
        "Release",
        "UPC",
        "Brut (EUR)",
        "% Artiste",
        "Royalties Artiste (EUR)",
        "Royalties Label (EUR)",
        "Streams/Ventes",
        "Avance Restante",
        "Recoupe",
        "Net a Payer (EUR)",
    ])

    for row in rows:
        is_total = row["release_title"] == "TOTAL"
        writer.writerow([
            row["artist_name"],
            row["release_title"],
            row["upc"],
            _fmt(row["gross"]),
            _pct(row["artist_share_pct"]) + "%" if not is_total else "",
            _fmt(row["artist_royalties"]),
            _fmt(row["label_royalties"]),
            row["streams"],
            _fmt(row.get("advance_balance", Decimal("0"))) if is_total else "",
            _fmt(row.get("recoupable", Decimal("0"))) if is_total else "",
            _fmt(row.get("net_payable", Decimal("0"))) if is_total else "",
        ])

    output.seek(0)
    filename = f"royalties_{period_start}_{period_end}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/royalties/pdf")
async def export_royalties_pdf(
    period_start: date,
    period_end: date,
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
):
    """Export royalties for all artists as PDF."""
    rows = await _compute_all_artists_royalties(db, period_start, period_end)

    # Build HTML for PDF
    html_parts = [
        "<!DOCTYPE html><html><head><meta charset='utf-8'>",
        "<style>",
        "body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 40px; color: #1A1A1A; font-size: 11px; }",
        "h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }",
        ".subtitle { color: #6E6E6E; font-size: 13px; margin-bottom: 30px; }",
        "table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }",
        "th { background: #F5F5F3; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 10px; text-transform: uppercase; color: #6E6E6E; border-bottom: 2px solid rgba(0,0,0,0.1); }",
        "td { padding: 7px 10px; border-bottom: 1px solid rgba(0,0,0,0.06); }",
        ".right { text-align: right; }",
        ".total-row { font-weight: 700; background: #FAFAF9; border-top: 2px solid rgba(0,0,0,0.1); }",
        ".total-row td { padding: 10px; }",
        ".artist-header { background: #6E56CF; color: white; padding: 10px 12px; font-size: 13px; font-weight: 600; border-radius: 6px 6px 0 0; margin-top: 20px; }",
        ".net { color: #30A46C; font-weight: 700; }",
        ".recoup { color: #E79D13; }",
        ".page-break { page-break-before: always; }",
        "</style></head><body>",
        "<h1>Rapport de Royalties</h1>",
        f"<div class='subtitle'>Periode : {period_start.strftime('%d/%m/%Y')} - {period_end.strftime('%d/%m/%Y')}</div>",
    ]

    # Group rows by artist
    current_artist = None
    artist_rows: list[dict] = []

    def flush_artist():
        nonlocal current_artist, artist_rows
        if not current_artist or not artist_rows:
            return

        html_parts.append(f"<div class='artist-header'>{current_artist}</div>")
        html_parts.append("<table>")
        html_parts.append("<tr><th>Release</th><th>UPC</th><th class='right'>Brut</th><th class='right'>%</th><th class='right'>Royalties</th><th class='right'>Streams</th></tr>")

        total_row = None
        for r in artist_rows:
            if r["release_title"] == "TOTAL":
                total_row = r
                continue
            html_parts.append(
                f"<tr>"
                f"<td>{r['release_title']}</td>"
                f"<td>{r['upc']}</td>"
                f"<td class='right'>{_fmt(r['gross'])} &euro;</td>"
                f"<td class='right'>{_pct(r['artist_share_pct'])}%</td>"
                f"<td class='right'>{_fmt(r['artist_royalties'])} &euro;</td>"
                f"<td class='right'>{r['streams']:,}</td>"
                f"</tr>"
            )

        if total_row:
            adv = total_row.get("advance_balance", Decimal("0"))
            rec = total_row.get("recoupable", Decimal("0"))
            net = total_row.get("net_payable", Decimal("0"))

            html_parts.append(
                f"<tr class='total-row'>"
                f"<td colspan='2'>Total</td>"
                f"<td class='right'>{_fmt(total_row['gross'])} &euro;</td>"
                f"<td></td>"
                f"<td class='right'>{_fmt(total_row['artist_royalties'])} &euro;</td>"
                f"<td class='right'>{total_row['streams']:,}</td>"
                f"</tr>"
            )

            if adv > 0:
                html_parts.append(
                    f"<tr class='total-row'>"
                    f"<td colspan='4'>Avance restante</td>"
                    f"<td class='right recoup'>{_fmt(adv)} &euro;</td>"
                    f"<td></td></tr>"
                )
                html_parts.append(
                    f"<tr class='total-row'>"
                    f"<td colspan='4'>Recoupe cette periode</td>"
                    f"<td class='right recoup'>-{_fmt(rec)} &euro;</td>"
                    f"<td></td></tr>"
                )
            html_parts.append(
                f"<tr class='total-row'>"
                f"<td colspan='4'><strong>Net a payer</strong></td>"
                f"<td class='right net'>{_fmt(net)} &euro;</td>"
                f"<td></td></tr>"
            )

        html_parts.append("</table>")
        artist_rows.clear()

    for row in rows:
        if row["artist_name"] != current_artist:
            flush_artist()
            current_artist = row["artist_name"]
        artist_rows.append(row)
    flush_artist()

    html_parts.append("</body></html>")
    html_content = "".join(html_parts)

    # Return HTML (can be printed as PDF from browser)
    filename = f"royalties_{period_start}_{period_end}.html"

    return StreamingResponse(
        iter([html_content]),
        media_type="text/html",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/transactions/csv")
async def export_transactions_csv(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    artist_id: Optional[PyUUID] = None,
    upc: Optional[str] = None,
    isrc: Optional[str] = None,
    year: Optional[int] = None,
    quarter: Optional[int] = None,
    source: Optional[str] = None,
):
    """Export transactions as CSV with optional filters."""
    conditions = []

    if artist_id:
        conditions.append(TransactionNormalized.artist_id == artist_id)
    if upc:
        conditions.append(TransactionNormalized.upc == upc)
    if isrc:
        conditions.append(TransactionNormalized.isrc == isrc)
    if year:
        conditions.append(extract("year", TransactionNormalized.period_start) == year)
        if quarter and 1 <= quarter <= 4:
            month_start = (quarter - 1) * 3 + 1
            month_end = quarter * 3
            conditions.append(extract("month", TransactionNormalized.period_start) >= month_start)
            conditions.append(extract("month", TransactionNormalized.period_start) <= month_end)
    if source:
        conditions.append(func.lower(cast(Import.source, SAString)) == source.lower())

    query = (
        select(
            TransactionNormalized.period_start,
            TransactionNormalized.period_end,
            Import.source,
            TransactionNormalized.artist_name,
            TransactionNormalized.release_title,
            TransactionNormalized.upc,
            TransactionNormalized.track_title,
            TransactionNormalized.isrc,
            TransactionNormalized.sale_type,
            TransactionNormalized.store_name,
            TransactionNormalized.quantity,
            TransactionNormalized.gross_amount,
            TransactionNormalized.currency,
        )
        .join(Import, TransactionNormalized.import_id == Import.id)
        .order_by(
            TransactionNormalized.period_start,
            TransactionNormalized.artist_name,
            TransactionNormalized.release_title,
        )
    )
    if conditions:
        query = query.where(and_(*conditions))

    result = await db.execute(query)
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "Periode Debut", "Periode Fin", "Source", "Artiste",
        "Sortie", "UPC", "Titre", "ISRC", "Type de vente",
        "Store", "Quantite", "Montant Brut", "Devise",
    ])
    for row in rows:
        source_val = (
            (row.source.value if hasattr(row.source, "value") else row.source)
            if row.source else ""
        )
        sale_type_val = (
            (row.sale_type.value if hasattr(row.sale_type, "value") else row.sale_type)
            if row.sale_type else ""
        )
        writer.writerow([
            str(row.period_start),
            str(row.period_end),
            source_val,
            row.artist_name or "",
            row.release_title or "",
            row.upc or "",
            row.track_title or "",
            row.isrc or "",
            sale_type_val,
            row.store_name or "",
            row.quantity or 0,
            _fmt(row.gross_amount),
            row.currency or "EUR",
        ])

    output.seek(0)
    parts = ["transactions"]
    if year:
        parts.append(str(year))
        if quarter:
            parts.append(f"Q{quarter}")
    if source:
        parts.append(source)
    filename = "_".join(parts) + ".csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/expenses/csv")
async def export_expenses_csv(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    artist_id: Optional[PyUUID] = None,
    year: Optional[int] = None,
    quarter: Optional[int] = None,
    category: Optional[str] = None,
):
    """Export advance/expense ledger entries as CSV with optional filters."""
    conditions = [AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE]

    if artist_id:
        conditions.append(AdvanceLedgerEntry.artist_id == artist_id)
    if category:
        conditions.append(AdvanceLedgerEntry.category == category)
    if year:
        conditions.append(extract("year", AdvanceLedgerEntry.effective_date) == year)
        if quarter and 1 <= quarter <= 4:
            month_start = (quarter - 1) * 3 + 1
            month_end = quarter * 3
            conditions.append(
                extract("month", AdvanceLedgerEntry.effective_date) >= month_start
            )
            conditions.append(
                extract("month", AdvanceLedgerEntry.effective_date) <= month_end
            )

    query = (
        select(
            AdvanceLedgerEntry.effective_date,
            Artist.name.label("artist_name"),
            AdvanceLedgerEntry.category,
            AdvanceLedgerEntry.scope,
            AdvanceLedgerEntry.scope_id,
            AdvanceLedgerEntry.amount,
            AdvanceLedgerEntry.currency,
            AdvanceLedgerEntry.description,
            AdvanceLedgerEntry.reference,
        )
        .outerjoin(Artist, AdvanceLedgerEntry.artist_id == Artist.id)
        .where(and_(*conditions))
        .order_by(AdvanceLedgerEntry.effective_date, Artist.name)
    )

    result = await db.execute(query)
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "Date", "Artiste", "Categorie", "Perimetre", "ID Perimetre",
        "Montant (EUR)", "Devise", "Description", "Reference",
    ])
    for row in rows:
        date_val = (
            row.effective_date.date().isoformat()
            if hasattr(row.effective_date, "date")
            else str(row.effective_date)
        )
        writer.writerow([
            date_val,
            row.artist_name or "Frais generaux",
            row.category or "",
            row.scope or "catalog",
            row.scope_id or "",
            _fmt(row.amount),
            row.currency or "EUR",
            row.description or "",
            row.reference or "",
        ])

    output.seek(0)
    parts = ["depenses"]
    if year:
        parts.append(str(year))
        if quarter:
            parts.append(f"Q{quarter}")
    if category:
        parts.append(category)
    filename = "_".join(parts) + ".csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/expenses/pdf")
async def export_expenses_pdf(
    db: Annotated[AsyncSession, Depends(get_db)],
    _token: Annotated[str, Depends(verify_admin_token)],
    artist_id: Optional[PyUUID] = None,
    year: Optional[int] = None,
    quarter: Optional[int] = None,
    category: Optional[str] = None,
):
    """Export advance/expense ledger entries as an HTML report (printable as PDF) with label logo."""
    from collections import defaultdict

    # Load label settings for logo
    settings_result = await db.execute(select(LabelSettings).limit(1))
    label = settings_result.scalars().first()
    label_name = label.label_name if label else "Whales Records"
    logo_src = (label.logo_base64 or label.logo_url) if label else None

    # Build query
    conditions = [AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE]
    if artist_id:
        conditions.append(AdvanceLedgerEntry.artist_id == artist_id)
    if category:
        conditions.append(AdvanceLedgerEntry.category == category)
    if year:
        conditions.append(extract("year", AdvanceLedgerEntry.effective_date) == year)
        if quarter and 1 <= quarter <= 4:
            month_start = (quarter - 1) * 3 + 1
            month_end = quarter * 3
            conditions.append(extract("month", AdvanceLedgerEntry.effective_date) >= month_start)
            conditions.append(extract("month", AdvanceLedgerEntry.effective_date) <= month_end)

    query = (
        select(
            AdvanceLedgerEntry.effective_date,
            Artist.name.label("artist_name"),
            AdvanceLedgerEntry.category,
            AdvanceLedgerEntry.scope,
            AdvanceLedgerEntry.scope_id,
            AdvanceLedgerEntry.amount,
            AdvanceLedgerEntry.currency,
            AdvanceLedgerEntry.description,
            AdvanceLedgerEntry.reference,
        )
        .outerjoin(Artist, AdvanceLedgerEntry.artist_id == Artist.id)
        .where(and_(*conditions))
        .order_by(Artist.name, AdvanceLedgerEntry.effective_date)
    )
    result = await db.execute(query)
    rows = result.all()

    # Resolve scope titles (isrc→track_title, upc→release_title)
    track_scope_ids = {r.scope_id for r in rows if r.scope == "track" and r.scope_id}
    release_scope_ids = {r.scope_id for r in rows if r.scope == "release" and r.scope_id}
    track_titles: dict[str, str] = {}
    release_titles: dict[str, str] = {}
    if track_scope_ids:
        tr = await db.execute(
            select(TransactionNormalized.isrc, TransactionNormalized.track_title)
            .where(TransactionNormalized.isrc.in_(track_scope_ids))
            .distinct(TransactionNormalized.isrc)
        )
        track_titles = {row.isrc: row.track_title for row in tr.all() if row.track_title}
    if release_scope_ids:
        rr = await db.execute(
            select(TransactionNormalized.upc, TransactionNormalized.release_title)
            .where(TransactionNormalized.upc.in_(release_scope_ids))
            .distinct(TransactionNormalized.upc)
        )
        release_titles = {row.upc: row.release_title for row in rr.all() if row.release_title}

    def _scope_label(r) -> str:
        if not r.scope or r.scope == "catalog":
            return "Catalogue"
        if r.scope == "track" and r.scope_id:
            title = track_titles.get(r.scope_id, r.scope_id)
            return f"Track : {title}"
        if r.scope == "release" and r.scope_id:
            title = release_titles.get(r.scope_id, r.scope_id)
            return f"Album : {title}"
        return r.scope.capitalize()

    # Group by artist
    by_artist: dict[str, list] = defaultdict(list)
    for row in rows:
        by_artist[row.artist_name or "Frais generaux"].append(row)

    # Period label
    q_labels = {1: "T1 (Jan–Mar)", 2: "T2 (Avr–Jun)", 3: "T3 (Jul–Sep)", 4: "T4 (Oct–Dec)"}
    if year:
        period_label = f"{year}" + (f" – {q_labels[quarter]}" if quarter else "")
    else:
        period_label = "Toutes périodes"

    cat_labels = {
        "mastering": "Mastering", "mixing": "Mixage", "recording": "Enregistrement",
        "photos": "Photos", "video": "Vidéo", "advertising": "Publicité",
        "groover": "Groover", "submithub": "SubmitHub", "google_ads": "Google Ads",
        "instagram": "Instagram", "tiktok": "TikTok", "facebook": "Facebook",
        "spotify_ads": "Spotify Ads", "pr": "PR / Presse", "distribution": "Distribution",
        "artwork": "Artwork", "cd": "CD", "vinyl": "Vinyles",
        "goodies": "Goodies / Merch", "accommodation": "Hébergement",
        "equipment_rental": "Location matériel", "other": "Autre",
    }

    logo_html = f'<img src="{logo_src}" class="logo" alt="{label_name}" />' if logo_src else ""

    blocks: list[str] = []
    for artist_nm, artist_rows in sorted(by_artist.items()):
        total = sum(r.amount for r in artist_rows)
        table_rows = []
        for r in artist_rows:
            date_str = r.effective_date.date().strftime("%d/%m/%Y") if hasattr(r.effective_date, "date") else str(r.effective_date)
            scope_str = _scope_label(r)
            table_rows.append(
                f"<tr>"
                f"<td>{date_str}</td>"
                f"<td>{cat_labels.get(r.category or '', r.category or '—')}</td>"
                f"<td class='mono'>{scope_str}</td>"
                f"<td>{r.description or '—'}</td>"
                f"<td class='mono'>{r.reference or '—'}</td>"
                f"<td class='right amount'>{_fmt(r.amount)} {r.currency or 'EUR'}</td>"
                f"</tr>"
            )
        blocks.append(
            f"<div class='artist-block'>"
            f"<div class='artist-header'>{artist_nm}</div>"
            f"<table>"
            f"<tr><th>Date</th><th>Categorie</th><th>Perimetre</th><th>Description</th><th>Ref</th><th class='right'>Montant</th></tr>"
            + "".join(table_rows) +
            f"<tr class='total-row'><td colspan='5'><strong>Total — {artist_nm}</strong></td>"
            f"<td class='right'><strong>{_fmt(total)} EUR</strong></td></tr>"
            f"</table></div>"
        )

    grand_total = sum(r.amount for r in rows)
    cat_filter_label = f" — {cat_labels.get(category, category)}" if category else ""

    html = f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>Avances et Depenses — {label_name}</title>
<style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 40px; }}
.header {{ display: flex; align-items: center; gap: 20px; margin-bottom: 30px; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; }}
.logo {{ max-height: 50px; max-width: 160px; object-fit: contain; }}
.header-text h1 {{ font-size: 18px; font-weight: 700; }}
.header-text .subtitle {{ color: #666; font-size: 12px; margin-top: 3px; }}
.artist-block {{ margin-bottom: 28px; }}
.artist-header {{ background: #1a1a1a; color: white; padding: 8px 12px; font-size: 13px; font-weight: 700; border-radius: 4px 4px 0 0; }}
table {{ width: 100%; border-collapse: collapse; border: 1px solid #e0e0e0; border-top: none; }}
th {{ background: #f5f5f3; padding: 7px 10px; text-align: left; font-weight: 600; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 1px solid #e0e0e0; }}
td {{ padding: 6px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }}
.right {{ text-align: right; white-space: nowrap; }}
.mono {{ font-family: monospace; font-size: 10px; color: #555; }}
.amount {{ font-weight: 600; color: #c0392b; }}
.total-row td {{ background: #fafaf9; font-size: 12px; border-top: 2px solid #e0e0e0; }}
.grand-total {{ margin-top: 24px; padding: 12px 16px; background: #f5f5f3; border-radius: 6px; text-align: right; font-size: 14px; font-weight: 700; }}
@media print {{ body {{ padding: 20px; }} }}
</style></head><body>
<div class="header">
  {logo_html}
  <div class="header-text">
    <h1>Avances &amp; Depenses</h1>
    <div class="subtitle">{label_name} — Periode : {period_label}{cat_filter_label}</div>
  </div>
</div>
{"".join(blocks)}
<div class="grand-total">Total general : {_fmt(grand_total)} EUR</div>
</body></html>"""

    fn = "depenses_" + (f"{year}" if year else "all") + (f"_Q{quarter}" if quarter else "") + ".html"
    return StreamingResponse(
        iter([html]),
        media_type="text/html",
        headers={"Content-Disposition": f'inline; filename="{fn}"'},
    )
