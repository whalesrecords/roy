'use client';

import { ReactNode, useEffect } from 'react';

/**
 * Bottom sheet primitive matching the ROY redesign prototype.
 * - Backdrop fades in (200ms)
 * - Sheet slides up from bottom (320ms cubic-bezier .32,.72,0,1)
 * - Click outside to dismiss
 * - Handle bar at top, padding inside
 *
 * Use for: artist details, validate-confirm, payout, track details, statement.
 */
export function Sheet({
  open, onClose, children, className = '',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  // Lock body scroll while sheet is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Scrim */}
      <div
        onClick={onClose}
        className="absolute inset-0 animate-[royFade_.2s_ease]"
        style={{ background: 'var(--scrim, rgba(0,0,0,0.6))' }}
      />
      {/* Sheet */}
      <div
        className={`absolute left-0 right-0 bottom-0 px-[22px] pt-[10px] pb-[30px]
          rounded-t-[30px] shadow-[0_-20px_60px_-16px_rgba(0,0,0,0.5)]
          animate-[roySheet_.32s_cubic-bezier(.32,.72,0,1)] ${className}`}
        style={{ background: 'var(--sheet, var(--surface))' }}
      >
        {/* Handle */}
        <div
          className="mx-auto mb-[18px] mt-[6px] h-[5px] w-[38px] rounded-full"
          style={{ background: 'var(--border-strong)' }}
        />
        {children}
      </div>
    </div>
  );
}
