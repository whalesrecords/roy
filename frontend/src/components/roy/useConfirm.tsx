'use client';

import { useCallback, useEffect, useState } from 'react';
import { AccentButton, OutlineButton } from '@/components/roy/ui';
import { IconCheck } from '@/components/roy/icons';

/**
 * Dialogue de confirmation intégré, courtois et accessible — remplace le
 * `window.confirm()` natif (voir docs/UX_GUIDE.md §8 : confirmation avant action
 * irréversible, gestion d'erreur sans popup système ; §5 : modale accessible,
 * fermable par Échap).
 *
 * API promise-based → quasi drop-in :
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title, message, danger: true, confirmLabel: 'Supprimer' }))) return;
 *   ...action...
 *   // puis rendre {dialog} dans le JSX de la page.
 */
export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type PendingConfirm = ConfirmOptions & { resolve: (ok: boolean) => void };

export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setPending({ ...opts, resolve }));
  }, []);

  const close = useCallback((ok: boolean) => {
    setPending((p) => {
      p?.resolve(ok);
      return null;
    });
  }, []);

  // Échap = annuler (WCAG 2.2 — modale fermable au clavier).
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, close]);

  const dialog = pending ? (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-label={pending.title}
      onClick={() => close(false)}
    >
      <div
        className="bg-surface w-full sm:max-w-sm sm:rounded-[16px] rounded-t-[16px] shadow-roy"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <h2 className="text-[16px] font-bold text-ink">{pending.title}</h2>
          <p className="text-[13px] leading-relaxed text-ink-muted mt-2">{pending.message}</p>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <OutlineButton onClick={() => close(false)} className="flex-1 justify-center">
            {pending.cancelLabel || 'Annuler'}
          </OutlineButton>
          {pending.danger ? (
            <button
              onClick={() => close(true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[10px] text-[13px] font-semibold bg-neg text-white hover:opacity-90 transition-opacity min-h-[44px]"
            >
              {pending.confirmLabel || 'Confirmer'}
            </button>
          ) : (
            <AccentButton onClick={() => close(true)} className="flex-1">
              <IconCheck size={14} /> {pending.confirmLabel || 'Confirmer'}
            </AccentButton>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
