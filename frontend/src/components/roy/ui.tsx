'use client';

import { ReactNode } from 'react';
import Link from 'next/link';

/* ── Card ── */
export function Card({
  children, className = '', hero = false, padded = true,
}: { children: ReactNode; className?: string; hero?: boolean; padded?: boolean }) {
  return (
    <div className={`${hero ? 'bg-hero' : 'bg-surface'} border border-line rounded-[16px] shadow-roy ${padded ? 'p-[17px]' : ''} ${className}`}>
      {children}
    </div>
  );
}

/* ── Eyebrow ── */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`roy-eyebrow text-[9.5px] ${className}`}>{children}</span>;
}

/* ── Pill ── */
export function Pill({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'neutral' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[10.5px] font-semibold ${
      tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-muted'
    }`}>
      {children}
    </span>
  );
}

/* ── KPI card ── */
export function Kpi({
  label, value, hint, hintTone = 'muted', hero = false, accentValue = false, href,
}: {
  label: string; value: string; hint?: string;
  hintTone?: 'muted' | 'accent'; hero?: boolean; accentValue?: boolean; href?: string;
}) {
  const inner = (
    <Card hero={hero} className={href ? 'transition-colors hover:border-line-strong cursor-pointer h-full' : 'h-full'}>
      <Eyebrow>{label}</Eyebrow>
      <div className={`roy-num text-[26px] font-bold mt-2 ${accentValue ? 'text-accent' : 'text-ink'}`}>{value}</div>
      {hint && <div className={`text-[11px] mt-1 ${hintTone === 'accent' ? 'text-accent font-semibold' : 'text-ink-faint'}`}>{hint}</div>}
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/* ── AccentButton ── */
export function AccentButton({
  children, onClick, className = '', type = 'button', disabled = false,
}: { children: ReactNode; onClick?: () => void; className?: string; type?: 'button' | 'submit'; disabled?: boolean }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] bg-accent px-4 py-2.5 text-[12px] font-bold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50 ${className}`}>
      {children}
    </button>
  );
}

/* ── OutlineButton ── */
export function OutlineButton({
  children, onClick, className = '', disabled = false, type = 'button',
}: { children: ReactNode; onClick?: () => void; className?: string; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-[10px] border border-line-strong bg-surface px-3.5 py-2 text-[12px] font-semibold text-ink hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}>
      {children}
    </button>
  );
}

/* ── Avatar initials ── */
export function Avatar({ name, src, size = 34, accent = false }: { name: string; src?: string; size?: number; accent?: boolean }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />;
  }
  return (
    <span
      style={{ width: size, height: size }}
      className={`rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${accent ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-muted'}`}>
      {initials}
    </span>
  );
}
