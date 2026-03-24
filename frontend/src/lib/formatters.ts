/**
 * Shared formatting utilities for the Whales Records admin frontend.
 * Replaces duplicated formatCurrency/formatDate/formatTimeAgo across pages.
 */

/**
 * Format a number or string as EUR currency.
 * @example formatCurrency(1234.56) → "1 234,56 €"
 * @example formatCurrency("1234.56", "USD") → "$1,234.56"
 */
export function formatCurrency(
  value: number | string,
  currency: string = 'EUR',
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0,00 €';
  return num.toLocaleString('fr-FR', { style: 'currency', currency });
}

/**
 * Format an ISO date string to French locale.
 * @example formatDate("2025-01-15") → "15 janv. 2025"
 * @example formatDate("2025-01-15", "long") → "15 janvier 2025"
 */
export function formatDate(
  date: string | null | undefined,
  style: 'short' | 'long' = 'short',
): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';

  if (style === 'long') {
    return d.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  return d.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a period range (e.g., "Janv. 2025 — Mars 2025").
 */
export function formatPeriod(start: string, end: string): string {
  return `${formatDate(start)} — ${formatDate(end)}`;
}

/**
 * Format a number with French locale.
 * @example formatNumber(1234567) → "1 234 567"
 */
export function formatNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('fr-FR');
}

/**
 * Format a relative time string (e.g., "il y a 5 min").
 */
export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHours < 24) return `il y a ${diffHours}h`;
  if (diffDays < 7) return `il y a ${diffDays}j`;
  return formatDate(dateString);
}
