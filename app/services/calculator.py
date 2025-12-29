"""
Royalty calculation service.

Business rules:
1. For each transaction, find applicable contract by priority:
   - scope='track' (match on ISRC)
   - scope='release' (match on UPC)
   - scope='catalog' (match on artist_id)

2. Contract validity: start_date <= period_end AND (end_date IS NULL OR end_date >= period_start)

3. Calculation:
   - artist_amount = amount_base * artist_share
   - label_amount = amount_base * label_share

4. Advance recoupment:
   - advance_balance = sum(advances) - sum(recoupments)
   - recouped = min(total_artist_royalties, advance_balance)
   - net_payable = total_artist_royalties - recouped
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Dict, List
from uuid import UUID

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.artist import Artist
from app.models.contract import Contract, ContractScope
from app.models.transaction import TransactionNormalized
from app.models.royalty_run import RoyaltyRun, RoyaltyRunStatus
from app.models.royalty_line_item import RoyaltyLineItem
from app.models.statement import Statement, StatementStatus
from app.models.advance_ledger import AdvanceLedgerEntry, LedgerEntryType
from app.services.fx import FXService, fx_service as default_fx_service

logger = logging.getLogger(__name__)


# Default split when no contract is found (50/50)
DEFAULT_ARTIST_SHARE = Decimal("0.5")
DEFAULT_LABEL_SHARE = Decimal("0.5")


@dataclass
class ArtistResult:
    """Aggregated results for a single artist."""
    artist_id: UUID
    artist_name: str
    gross: Decimal = Decimal("0")
    artist_royalties: Decimal = Decimal("0")
    label_royalties: Decimal = Decimal("0")
    advance_balance_before: Decimal = Decimal("0")
    recouped: Decimal = Decimal("0")
    advance_balance_after: Decimal = Decimal("0")
    net_payable: Decimal = Decimal("0")
    transaction_count: int = 0


@dataclass
class CalculationResult:
    """Result of a royalty calculation run."""
    run_id: UUID
    period_start: date
    period_end: date
    base_currency: str
    total_transactions: int = 0
    total_gross: Decimal = Decimal("0")
    total_artist_royalties: Decimal = Decimal("0")
    total_label_royalties: Decimal = Decimal("0")
    total_recouped: Decimal = Decimal("0")
    total_net_payable: Decimal = Decimal("0")
    artists: Dict[UUID, ArtistResult] = field(default_factory=dict)
    import_ids: List[UUID] = field(default_factory=list)


class RoyaltyCalculator:
    """
    Service for calculating royalties.

    This service is stateless and testable. All database operations
    are passed through the session parameter.
    """

    def __init__(self, fx_service: FXService | None = None):
        """
        Initialize calculator.

        Args:
            fx_service: FX conversion service (defaults to global fx_service)
        """
        self.fx = fx_service or default_fx_service

    async def get_or_create_artist(
        self,
        db: AsyncSession,
        artist_name: str,
    ) -> Artist:
        """
        Get or create an artist by name.

        Args:
            db: Database session
            artist_name: Artist name to find or create

        Returns:
            Artist instance
        """
        # Try to find existing artist
        result = await db.execute(
            select(Artist).where(Artist.name == artist_name)
        )
        artist = result.scalar_one_or_none()

        if artist is None:
            # Create new artist
            artist = Artist(name=artist_name)
            db.add(artist)
            await db.flush()
            logger.info(f"Created new artist: {artist_name} (id={artist.id})")

        return artist

    async def find_applicable_contract(
        self,
        db: AsyncSession,
        artist_id: UUID,
        isrc: str | None,
        upc: str | None,
        period_start: date,
        period_end: date,
    ) -> Contract | None:
        """
        Find the most specific applicable contract for a transaction.

        Priority order:
        1. Track-level contract (ISRC match)
        2. Release-level contract (UPC match)
        3. Catalog-level contract (artist-wide)

        Args:
            db: Database session
            artist_id: Artist UUID
            isrc: Track ISRC (optional)
            upc: Release UPC (optional)
            period_start: Transaction period start
            period_end: Transaction period end

        Returns:
            Most specific applicable Contract or None
        """
        # Build validity conditions
        validity_condition = and_(
            Contract.start_date <= period_end,
            or_(
                Contract.end_date.is_(None),
                Contract.end_date >= period_start,
            ),
        )

        # Try track-level contract first
        if isrc:
            result = await db.execute(
                select(Contract).where(
                    Contract.artist_id == artist_id,
                    Contract.scope == ContractScope.TRACK,
                    Contract.scope_id == isrc,
                    validity_condition,
                )
            )
            contract = result.scalar_one_or_none()
            if contract:
                return contract

        # Try release-level contract
        if upc:
            result = await db.execute(
                select(Contract).where(
                    Contract.artist_id == artist_id,
                    Contract.scope == ContractScope.RELEASE,
                    Contract.scope_id == upc,
                    validity_condition,
                )
            )
            contract = result.scalar_one_or_none()
            if contract:
                return contract

        # Try catalog-level contract
        result = await db.execute(
            select(Contract).where(
                Contract.artist_id == artist_id,
                Contract.scope == ContractScope.CATALOG,
                validity_condition,
            )
        )
        return result.scalar_one_or_none()

    async def get_advance_balance(
        self,
        db: AsyncSession,
        artist_id: UUID,
    ) -> Decimal:
        """
        Calculate current advance balance for an artist.

        balance = sum(advances) - sum(recoupments)

        Args:
            db: Database session
            artist_id: Artist UUID

        Returns:
            Current advance balance (positive = unrecouped advance)
        """
        # Sum advances
        advance_result = await db.execute(
            select(func.coalesce(func.sum(AdvanceLedgerEntry.amount), 0)).where(
                AdvanceLedgerEntry.artist_id == artist_id,
                AdvanceLedgerEntry.entry_type == LedgerEntryType.ADVANCE,
            )
        )
        total_advances = Decimal(str(advance_result.scalar()))

        # Sum recoupments
        recoupment_result = await db.execute(
            select(func.coalesce(func.sum(AdvanceLedgerEntry.amount), 0)).where(
                AdvanceLedgerEntry.artist_id == artist_id,
                AdvanceLedgerEntry.entry_type == LedgerEntryType.RECOUPMENT,
            )
        )
        total_recoupments = Decimal(str(recoupment_result.scalar()))

        return total_advances - total_recoupments

    async def calculate_run(
        self,
        db: AsyncSession,
        period_start: date,
        period_end: date,
        base_currency: str = "USD",
    ) -> CalculationResult:
        """
        Execute a royalty calculation run.

        Args:
            db: Database session
            period_start: Start of period (inclusive)
            period_end: End of period (inclusive)
            base_currency: Currency for calculations

        Returns:
            CalculationResult with all calculated data
        """
        logger.info(f"Starting royalty run for period {period_start} to {period_end}")

        # Create the run record
        run = RoyaltyRun(
            period_start=period_start,
            period_end=period_end,
            base_currency=base_currency,
            status=RoyaltyRunStatus.PROCESSING,
        )
        db.add(run)
        await db.flush()

        result = CalculationResult(
            run_id=run.id,
            period_start=period_start,
            period_end=period_end,
            base_currency=base_currency,
        )

        try:
            # Get all transactions for the period
            tx_result = await db.execute(
                select(TransactionNormalized).where(
                    TransactionNormalized.period_start >= period_start,
                    TransactionNormalized.period_end <= period_end,
                )
            )
            transactions = tx_result.scalars().all()

            logger.info(f"Found {len(transactions)} transactions for period")

            # Track import IDs for audit
            import_ids_set: set[UUID] = set()

            # Process each transaction
            artist_cache: Dict[str, Artist] = {}

            for tx in transactions:
                import_ids_set.add(tx.import_id)

                # Get or create artist
                if tx.artist_name not in artist_cache:
                    artist = await self.get_or_create_artist(db, tx.artist_name)
                    artist_cache[tx.artist_name] = artist
                else:
                    artist = artist_cache[tx.artist_name]

                # Find applicable contract
                contract = await self.find_applicable_contract(
                    db,
                    artist.id,
                    tx.isrc,
                    tx.upc,
                    tx.period_start,
                    tx.period_end,
                )

                # Determine splits
                if contract:
                    logger.info(f"Found contract for {tx.artist_name}: {contract.scope.value} @ {contract.artist_share*100}%")
                    artist_share = contract.artist_share
                    label_share = contract.label_share
                else:
                    logger.warning(f"No contract found for {tx.artist_name} (artist_id={artist.id}), using default 50/50 split")
                    artist_share = DEFAULT_ARTIST_SHARE
                    label_share = DEFAULT_LABEL_SHARE

                # Convert to base currency
                amount_base, fx_rate = self.fx.convert(
                    tx.gross_amount,
                    tx.currency,
                    base_currency,
                    tx.period_end,
                )

                # Calculate amounts
                artist_amount = amount_base * artist_share
                label_amount = amount_base * label_share

                # Create line item
                line_item = RoyaltyLineItem(
                    royalty_run_id=run.id,
                    transaction_id=tx.id,
                    contract_id=contract.id if contract else None,
                    artist_id=artist.id,
                    artist_name=tx.artist_name,
                    track_title=tx.track_title,
                    release_title=tx.release_title,
                    isrc=tx.isrc,
                    upc=tx.upc,
                    gross_amount=tx.gross_amount,
                    original_currency=tx.currency,
                    amount_base=amount_base,
                    fx_rate=fx_rate,
                    artist_share=artist_share,
                    label_share=label_share,
                    artist_amount=artist_amount,
                    label_amount=label_amount,
                )
                db.add(line_item)

                # Aggregate by artist
                if artist.id not in result.artists:
                    result.artists[artist.id] = ArtistResult(
                        artist_id=artist.id,
                        artist_name=tx.artist_name,
                    )

                artist_result = result.artists[artist.id]
                artist_result.gross += amount_base
                artist_result.artist_royalties += artist_amount
                artist_result.label_royalties += label_amount
                artist_result.transaction_count += 1

                # Update totals
                result.total_transactions += 1
                result.total_gross += amount_base
                result.total_artist_royalties += artist_amount
                result.total_label_royalties += label_amount

            # Flush line items
            await db.flush()

            # Handle recoupment for each artist
            for artist_id, artist_result in result.artists.items():
                # Get current advance balance
                advance_balance = await self.get_advance_balance(db, artist_id)
                artist_result.advance_balance_before = advance_balance

                # Calculate recoupment
                if advance_balance > 0:
                    recouped = min(artist_result.artist_royalties, advance_balance)
                    artist_result.recouped = recouped
                    artist_result.advance_balance_after = advance_balance - recouped

                    # Create recoupment ledger entry
                    if recouped > 0:
                        ledger_entry = AdvanceLedgerEntry(
                            artist_id=artist_id,
                            entry_type=LedgerEntryType.RECOUPMENT,
                            amount=recouped,
                            currency=base_currency,
                            royalty_run_id=run.id,
                            description=f"Recoupment from royalty run {run.id}",
                        )
                        db.add(ledger_entry)

                    result.total_recouped += recouped
                else:
                    artist_result.advance_balance_after = advance_balance

                # Calculate net payable
                artist_result.net_payable = artist_result.artist_royalties - artist_result.recouped
                result.total_net_payable += artist_result.net_payable

                # Create statement
                statement = Statement(
                    artist_id=artist_id,
                    royalty_run_id=run.id,
                    period_start=period_start,
                    period_end=period_end,
                    currency=base_currency,
                    status=StatementStatus.DRAFT,
                    gross_revenue=artist_result.gross,
                    artist_royalties=artist_result.artist_royalties,
                    label_royalties=artist_result.label_royalties,
                    advance_balance_before=artist_result.advance_balance_before,
                    recouped=artist_result.recouped,
                    advance_balance_after=artist_result.advance_balance_after,
                    net_payable=artist_result.net_payable,
                    transaction_count=artist_result.transaction_count,
                )
                db.add(statement)

            # Update run with totals (convert UUIDs to strings for JSON storage)
            run.import_ids = [str(uid) for uid in import_ids_set]
            run.total_transactions = result.total_transactions
            run.total_gross = result.total_gross
            run.total_artist_royalties = result.total_artist_royalties
            run.total_label_royalties = result.total_label_royalties
            run.total_recouped = result.total_recouped
            run.total_net_payable = result.total_net_payable
            run.status = RoyaltyRunStatus.COMPLETED
            run.completed_at = datetime.utcnow()

            result.import_ids = [str(uid) for uid in import_ids_set]

            await db.flush()

            logger.info(
                f"Royalty run completed: {result.total_transactions} transactions, "
                f"{len(result.artists)} artists, "
                f"total_gross={result.total_gross}, "
                f"total_artist_royalties={result.total_artist_royalties}, "
                f"total_net_payable={result.total_net_payable}"
            )

            return result

        except Exception as e:
            logger.error(f"Royalty run failed: {e}")
            run.status = RoyaltyRunStatus.FAILED
            run.error_message = str(e)
            await db.flush()
            raise

    async def lock_run(
        self,
        db: AsyncSession,
        run_id: UUID,
    ) -> RoyaltyRun:
        """
        Lock a royalty run, preventing further modifications.

        Also finalizes all statements for the run.

        Args:
            db: Database session
            run_id: ID of the run to lock

        Returns:
            Updated RoyaltyRun

        Raises:
            ValueError: If run not found or already locked
        """
        result = await db.execute(
            select(RoyaltyRun)
            .options(selectinload(RoyaltyRun.statements))
            .where(RoyaltyRun.id == run_id)
        )
        run = result.scalar_one_or_none()

        if run is None:
            raise ValueError(f"Royalty run {run_id} not found")

        if run.is_locked:
            raise ValueError(f"Royalty run {run_id} is already locked")

        if run.status != RoyaltyRunStatus.COMPLETED:
            raise ValueError(
                f"Cannot lock run in status {run.status}. "
                f"Run must be COMPLETED first."
            )

        # Lock the run
        run.is_locked = True
        run.status = RoyaltyRunStatus.LOCKED
        run.locked_at = datetime.utcnow()

        # Finalize all statements
        for statement in run.statements:
            statement.status = StatementStatus.FINALIZED
            statement.finalized_at = datetime.utcnow()

        await db.flush()

        logger.info(f"Royalty run {run_id} locked")

        return run

    async def get_run(
        self,
        db: AsyncSession,
        run_id: UUID,
    ) -> RoyaltyRun | None:
        """
        Get a royalty run by ID with all relationships loaded.

        Args:
            db: Database session
            run_id: Run ID

        Returns:
            RoyaltyRun or None if not found
        """
        result = await db.execute(
            select(RoyaltyRun)
            .options(
                selectinload(RoyaltyRun.statements),
                selectinload(RoyaltyRun.recoupment_entries),
            )
            .where(RoyaltyRun.id == run_id)
        )
        return result.scalar_one_or_none()

    async def get_artist_statements(
        self,
        db: AsyncSession,
        artist_id: UUID,
    ) -> List[Statement]:
        """
        Get all statements for an artist.

        Args:
            db: Database session
            artist_id: Artist UUID

        Returns:
            List of statements ordered by period (newest first)
        """
        result = await db.execute(
            select(Statement)
            .where(Statement.artist_id == artist_id)
            .order_by(Statement.period_end.desc())
        )
        return list(result.scalars().all())


# Default calculator instance
calculator = RoyaltyCalculator(fx_service=default_fx_service)
