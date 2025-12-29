"""
Foreign Exchange (FX) conversion service.

MVP Implementation:
- Uses a fallback rate of 1.0 for all conversions
- Interface designed for future integration with FX rate providers

Future enhancements:
- Integrate with ECB, Open Exchange Rates, or similar API
- Cache rates by date
- Support historical rates
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Protocol, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class FXProvider(Protocol):
    """Protocol for FX rate providers."""

    def get_rate(
        self,
        from_currency: str,
        to_currency: str,
        rate_date: date,
    ) -> Decimal:
        """Get exchange rate for converting from one currency to another."""
        ...


class FallbackFXProvider:
    """
    Fallback FX provider that returns 1.0 for all conversions.

    This is the MVP implementation. In production, this would be
    replaced with a real FX rate provider.
    """

    def get_rate(
        self,
        from_currency: str,
        to_currency: str,
        rate_date: date,
    ) -> Decimal:
        """
        Get exchange rate (always returns 1.0 in MVP).

        Args:
            from_currency: Source currency code (e.g., "EUR")
            to_currency: Target currency code (e.g., "USD")
            rate_date: Date for the exchange rate

        Returns:
            Exchange rate as Decimal (1.0 in MVP)
        """
        if from_currency == to_currency:
            return Decimal("1")

        # MVP: Log and return 1.0 fallback
        logger.warning(
            f"FX conversion requested: {from_currency} -> {to_currency} "
            f"on {rate_date}. Using fallback rate 1.0"
        )
        return Decimal("1")


class FXService:
    """
    FX conversion service.

    Provides currency conversion with pluggable FX providers.
    Falls back to 1.0 rate if no provider is configured or on error.
    """

    def __init__(self, provider: FXProvider | None = None):
        """
        Initialize FX service.

        Args:
            provider: FX rate provider (defaults to FallbackFXProvider)
        """
        self.provider = provider or FallbackFXProvider()

    def convert(
        self,
        amount: Decimal,
        from_currency: str,
        to_currency: str,
        rate_date: date,
    ) -> tuple[Decimal, Decimal]:
        """
        Convert amount from one currency to another.

        Args:
            amount: Amount to convert
            from_currency: Source currency code
            to_currency: Target currency code
            rate_date: Date for the exchange rate

        Returns:
            Tuple of (converted_amount, rate_used)
        """
        if from_currency == to_currency:
            return amount, Decimal("1")

        try:
            rate = self.provider.get_rate(from_currency, to_currency, rate_date)
            converted = amount * rate
            return converted, rate
        except Exception as e:
            logger.error(
                f"Error getting FX rate for {from_currency} -> {to_currency}: {e}. "
                f"Using fallback rate 1.0"
            )
            return amount, Decimal("1")

    def get_rate(
        self,
        from_currency: str,
        to_currency: str,
        rate_date: date,
    ) -> Decimal:
        """
        Get exchange rate for converting from one currency to another.

        Args:
            from_currency: Source currency code
            to_currency: Target currency code
            rate_date: Date for the exchange rate

        Returns:
            Exchange rate as Decimal
        """
        if from_currency == to_currency:
            return Decimal("1")

        try:
            return self.provider.get_rate(from_currency, to_currency, rate_date)
        except Exception as e:
            logger.error(
                f"Error getting FX rate: {e}. Using fallback rate 1.0"
            )
            return Decimal("1")


# Default service instance (can be replaced in tests or with real provider)
fx_service = FXService()
