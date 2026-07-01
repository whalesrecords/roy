"""Periodic admin alert scanner.

Writes label-facing admin ``Notification`` rows (and an admin push) for
conditions that need attention but aren't tied to a single user action:

- **Imports en retard** : plus aucun import de ventes depuis longtemps.
- **Relevé non payé** : relevé finalisé, net à payer > 0, non réglé depuis longtemps.
- **Avance non recoupée élevée** : exposition non récupérée d'un artiste au-dessus d'un seuil.
- **Dépenses élevées (30 j)** : total dépensé/avancé sur 30 jours au-dessus d'un seuil.

(Les tickets sont déjà notifiés à l'événement — voir routers/artist_portal.py.)

Runs as a daily background task (see ``app/main.py``). Idempotent within a
re-alert window: the same condition never re-notifies more than once per
``RE_ALERT_DAYS``, keyed by a stable ``dedup_key`` stored in ``Notification.data``.
All thresholds below are plain constants — tune them here.
"""
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.advance_ledger import AdvanceLedgerEntry, LedgerEntryType
from app.models.artist import Artist
from app.models.import_model import Import
from app.models.notification import Notification, NotificationType
from app.models.statement import Statement, StatementStatus
from app.services.push import send_admin_push

logger = logging.getLogger(__name__)

# ── Tunable thresholds ────────────────────────────────────────────────
STALE_IMPORT_DAYS = 45              # alerte si aucun import de ventes depuis N jours
UNPAID_STATEMENT_DAYS = 30          # alerte si relevé finalisé non payé depuis N jours
HIGH_UNRECOUPED_ADVANCE = Decimal("1500")   # € d'avance non recoupée par artiste
HIGH_SPEND_WINDOW_DAYS = 30         # fenêtre glissante pour les dépenses
HIGH_SPEND_THRESHOLD = Decimal("2000")      # € de dépenses/avances sur la fenêtre
RE_ALERT_DAYS = 7                   # ne pas répéter la même alerte avant N jours
MAX_UNPAID_ALERTS = 25              # plafond de relevés impayés notifiés par scan


async def _already_alerted(db: AsyncSession, notif_type: str, dedup_key: str) -> bool:
    """True if an alert of this type + dedup_key was created within RE_ALERT_DAYS."""
    since = datetime.utcnow() - timedelta(days=RE_ALERT_DAYS)
    rows = (
        await db.execute(
            select(Notification.data).where(
                Notification.notification_type == notif_type,
                Notification.created_at >= since,
            )
        )
    ).scalars().all()
    for raw in rows:
        if not raw:
            continue
        try:
            if json.loads(raw).get("dedup_key") == dedup_key:
                return True
        except Exception:  # noqa: BLE001 — malformed data must never crash the scan
            continue
    return False


async def _emit(
    db: AsyncSession,
    notif_type: str,
    title: str,
    message: str,
    dedup_key: str,
    artist_id=None,
    extra: dict | None = None,
    push: bool = True,
) -> bool:
    """Create an admin notification (+ push) unless already alerted recently."""
    if await _already_alerted(db, notif_type, dedup_key):
        return False
    data = {"dedup_key": dedup_key}
    if extra:
        data.update(extra)
    db.add(
        Notification(
            notification_type=notif_type,
            artist_id=artist_id,
            title=title,
            message=message,
            data=json.dumps(data),
        )
    )
    await db.commit()
    if push:
        await send_admin_push(db, title, message or "", {"type": notif_type})
    return True


async def _scan_stale_imports(db: AsyncSession) -> None:
    last = (await db.execute(select(func.max(Import.created_at)))).scalar()
    if last is None:
        return  # aucun import : nouvelle install, on ne harcèle pas
    days = (datetime.utcnow() - last).days
    if days >= STALE_IMPORT_DAYS:
        await _emit(
            db,
            NotificationType.IMPORTS_STALE.value,
            "Imports de ventes en retard",
            f"Aucun import de ventes depuis {days} jours "
            f"(dernier le {last.date().isoformat()}). Pensez à importer les derniers relevés.",
            dedup_key=f"stale-import-{last.date().isoformat()}",
            extra={"days": days, "last_import": last.date().isoformat()},
        )


async def _scan_unpaid_statements(db: AsyncSession) -> None:
    cutoff = datetime.utcnow() - timedelta(days=UNPAID_STATEMENT_DAYS)
    rows = (
        await db.execute(
            select(Statement, Artist.name)
            .join(Artist, Artist.id == Statement.artist_id)
            .where(
                Statement.status == StatementStatus.FINALIZED,
                Statement.net_payable > 0,
                Statement.finalized_at.is_not(None),
                Statement.finalized_at <= cutoff,
            )
            .order_by(Statement.finalized_at.asc())
            .limit(MAX_UNPAID_ALERTS)
        )
    ).all()
    for st, artist_name in rows:
        days = (datetime.utcnow() - st.finalized_at).days
        await _emit(
            db,
            NotificationType.STATEMENT_UNPAID.value,
            "Relevé non payé",
            f"{artist_name} : {st.net_payable} {st.currency} à verser "
            f"(relevé finalisé il y a {days} jours).",
            dedup_key=f"unpaid-{st.id}",
            artist_id=st.artist_id,
            extra={
                "statement_id": str(st.id),
                "amount": str(st.net_payable),
                "currency": st.currency,
            },
        )


async def _scan_unrecouped(db: AsyncSession) -> None:
    rows = (
        await db.execute(
            select(
                AdvanceLedgerEntry.artist_id,
                Artist.name,
                func.sum(
                    case(
                        (AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE, AdvanceLedgerEntry.amount),
                        else_=0,
                    )
                ).label("adv"),
                func.sum(
                    case(
                        (AdvanceLedgerEntry.entry_type == LedgerEntryType.RECOUPMENT, AdvanceLedgerEntry.amount),
                        else_=0,
                    )
                ).label("rec"),
            )
            .join(Artist, Artist.id == AdvanceLedgerEntry.artist_id)
            .where(AdvanceLedgerEntry.artist_id.is_not(None))
            .group_by(AdvanceLedgerEntry.artist_id, Artist.name)
        )
    ).all()
    for artist_id, name, adv, rec in rows:
        unrecouped = abs(Decimal(adv or 0)) - abs(Decimal(rec or 0))
        if unrecouped >= HIGH_UNRECOUPED_ADVANCE:
            # Bucket par tranche de 500 € : re-alerte quand l'exposition franchit un palier.
            bucket = int(unrecouped // 500)
            await _emit(
                db,
                NotificationType.ADVANCE_UNRECOUPED.value,
                "Avance non recoupée élevée",
                f"{name or 'Artiste'} : {unrecouped:.0f} € d'avance non recoupée.",
                dedup_key=f"unrecouped-{artist_id}-{bucket}",
                artist_id=artist_id,
                extra={"unrecouped": str(unrecouped)},
            )


async def _scan_high_spend(db: AsyncSession) -> None:
    cutoff = datetime.utcnow() - timedelta(days=HIGH_SPEND_WINDOW_DAYS)
    total = (
        await db.execute(
            select(func.sum(AdvanceLedgerEntry.amount)).where(
                AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE,
                AdvanceLedgerEntry.effective_date >= cutoff,
            )
        )
    ).scalar()
    total = abs(Decimal(total or 0))
    if total >= HIGH_SPEND_THRESHOLD:
        iso = datetime.utcnow().isocalendar()  # (année ISO, semaine ISO, jour)
        await _emit(
            db,
            NotificationType.SPEND_HIGH.value,
            "Dépenses élevées (30 j)",
            f"{total:.0f} € de dépenses/avances sur les {HIGH_SPEND_WINDOW_DAYS} derniers jours.",
            dedup_key=f"spend-{iso[0]}-W{iso[1]}",  # au plus une fois par semaine
            extra={"total": str(total), "window_days": HIGH_SPEND_WINDOW_DAYS},
        )


async def scan_admin_alerts(db: AsyncSession) -> None:
    """Run every admin-alert sub-scan; one failing scan never aborts the others."""
    for fn in (_scan_stale_imports, _scan_unpaid_statements, _scan_unrecouped, _scan_high_spend):
        try:
            await fn(db)
        except Exception as exc:  # noqa: BLE001 — a bad scan must not kill the loop
            logger.error("admin alert %s failed: %s", fn.__name__, exc, exc_info=True)
