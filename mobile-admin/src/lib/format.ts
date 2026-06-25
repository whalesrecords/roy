/**
 * Formatters — fr-FR, sans dépendre d'Intl (Hermes), 2 décimales pour l'argent.
 */

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // espace insécable
}

const SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };

/** Montant toujours avec 2 décimales : 3604 -> "3 604,00 €". */
export function fmtMoney(v: string | number | null | undefined, currency = 'EUR'): string {
  const n = typeof v === 'string' ? parseFloat(v) : v ?? NaN;
  if (n == null || !isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const [intPart, dec] = Math.abs(n).toFixed(2).split('.');
  const sym = SYMBOLS[currency] || currency;
  return `${sign}${groupThousands(intPart)},${dec} ${sym}`;
}

/** Nombre compact : 1 050 000 -> "1,05 M", 25 000 -> "25 K". */
export function fmtNum(v: number | null | undefined): string {
  const n = v ?? 0;
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace('.', ',')} M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)} K`;
  return groupThousands(String(Math.round(n)));
}

/** Pourcentage : fmtPct(12.3) -> "12,3 %". */
export function fmtPct(v: number | null | undefined, signed = false): string {
  const n = v ?? 0;
  const s = n.toFixed(1).replace('.', ',');
  return `${signed && n > 0 ? '+' : ''}${s} %`;
}

/** Décimale brute : "1.47" -> "1,47". */
export function fmtDec(v: string | number | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : v ?? NaN;
  if (n == null || !isFinite(n)) return '—';
  return n.toFixed(2).replace('.', ',').replace(/,00$/, '');
}

/** "2026-06-24" -> "24 juin". */
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function fmtDateShort(str: string | null | undefined): string {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtDateLong(str: string | null | undefined): string {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
