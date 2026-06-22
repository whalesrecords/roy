'use client';

import { ReactNode } from 'react';

/* ──────────────────────────────────────────────────────────────
   Formatters — fr-FR, tabular
   ────────────────────────────────────────────────────────────── */
export function fmtMoney(v: string | number, currency = 'EUR', opts?: Intl.NumberFormatOptions) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0, ...opts });
}

export function fmtNum(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M`;
  if (v >= 1_000) return `${(v / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} K`;
  return v.toLocaleString('fr-FR');
}

export function fmtPct(v: number, signed = false) {
  const s = v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return `${signed && v > 0 ? '+' : ''}${s} %`;
}

/* ──────────────────────────────────────────────────────────────
   Card — surface panel
   ────────────────────────────────────────────────────────────── */
export function Card({
  children,
  className = '',
  hero = false,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  hero?: boolean;
  padded?: boolean;
}) {
  return (
    <div
      className={`${hero ? 'bg-hero' : 'bg-surface'} border border-line rounded-[18px] shadow-roy ${padded ? 'p-[18px]' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Eyebrow — mono uppercase label
   ────────────────────────────────────────────────────────────── */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`roy-eyebrow text-[10px] ${className}`}>{children}</span>;
}

/* ──────────────────────────────────────────────────────────────
   Pill — accent / neutral status badge
   ────────────────────────────────────────────────────────────── */
export function Pill({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'neutral' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${
        tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-muted'
      }`}
    >
      {children}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────
   Segmented — year / tab switcher
   ────────────────────────────────────────────────────────────── */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  fill = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  fill?: boolean;
}) {
  return (
    <div className={`flex gap-1 rounded-[11px] border border-line bg-surface p-1 ${fill ? 'w-full' : ''}`}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-${active ? 'semibold' : 'medium'} transition-colors ${
              fill ? 'flex-1' : ''
            } ${active ? 'bg-ink text-app' : 'text-ink-muted hover:text-ink'}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Sparkline — inline area + line SVG
   points: array of y-values (any scale); auto-normalised.
   ────────────────────────────────────────────────────────────── */
export function Sparkline({
  points,
  height = 40,
  className = '',
  filled = true,
}: {
  points: number[];
  height?: number;
  className?: string;
  filled?: boolean;
}) {
  if (!points || points.length < 2) return null;
  const W = 100;
  const H = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = W / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = H - 2 - ((p - min) / span) * (H - 4);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`block w-full ${className}`}
      style={{ height }}
    >
      {filled && <path d={area} fill="var(--accent-soft)" />}
      <path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.8}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   DesktopTopbar — per-page header (lg+ only); pairs with sidebar
   ────────────────────────────────────────────────────────────── */
export function DesktopTopbar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="hidden lg:flex items-center justify-between px-7 py-[22px] border-b border-line">
      <div>
        <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">{title}</div>
        {subtitle && <div className="text-[12.5px] text-ink-faint mt-0.5">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   AccentButton — primary CTA on accent
   ────────────────────────────────────────────────────────────── */
export function AccentButton({
  children,
  onClick,
  className = '',
  type = 'button',
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-[13px] bg-accent px-4 py-2.5 text-[13px] font-bold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────
   Platform brand colours
   ────────────────────────────────────────────────────────────── */
export const PLATFORM_COLORS: Record<string, string> = {
  spotify: '#1DB954',
  apple_music: '#FC3C44',
  apple: '#FC3C44',
  deezer: '#00C7F2',
  youtube: '#FF3B30',
  youtube_music: '#FF3B30',
  amazon: '#FF9900',
  amazon_music: '#FF9900',
  tiktok: '#25C9D6',
  soundcloud: '#FF7700',
  bandcamp: '#6E9CA8',
  tidal: '#88C0D0',
  other: '#9AA0A8',
};

export function platformColor(key: string) {
  return PLATFORM_COLORS[key?.toLowerCase()] || PLATFORM_COLORS.other;
}
