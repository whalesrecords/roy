'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@heroui/react';
import { getRoyaltyRuns, lockRoyaltyRun, RoyaltyRun } from '@/lib/api';
import { AdminBottomNav } from '@/components/roy/AdminBottomNav';
import { Eyebrow, Pill } from '@/components/roy/ui';
import { Sheet } from '@/components/roy/Sheet';

const fmtEUR = (s: string | number) => {
  const n = typeof s === 'string' ? parseFloat(s) : s;
  return (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
};

const fmtPeriod = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const q = Math.floor(s.getMonth() / 3) + 1;
  return `Q${q} ${e.getFullYear()}`;
};

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export default function MobileRoyaltiesPage() {
  const [runs, setRuns] = useState<RoyaltyRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [showValidate, setShowValidate] = useState(false);
  const [showValidated, setShowValidated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getRoyaltyRuns();
        setRuns(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Latest draft run = the one to validate
  const draft = runs.find(r => !r.is_locked);
  const totalDue = draft ? parseFloat(draft.total_net_payable) : 0;
  const artists = draft?.artists || [];

  const handleValidate = async () => {
    if (!draft) return;
    setValidating(true);
    try {
      await lockRoyaltyRun(draft.run_id);
      setShowValidate(false);
      setShowValidated(true);
      // Refresh runs
      const data = await getRoyaltyRuns();
      setRuns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la validation');
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-[124px]" style={{ background: 'var(--bg)' }}>
      <div className="px-5 pt-2 max-w-md mx-auto">
        <div className="py-2 mb-4">
          <h1 className="text-[22px] font-bold tracking-[-0.025em]" style={{ color: 'var(--text)' }}>
            Royalties
          </h1>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            {draft ? `Calcul ${fmtPeriod(draft.period_start, draft.period_end)} · brouillon` : 'Aucun brouillon en cours'}
          </div>
        </div>

        {error && (
          <div className="mb-3 px-4 py-3 rounded-[12px] border border-line text-sm text-neg" style={{ background: 'var(--surface)' }}>
            {error}
          </div>
        )}

        {/* Hero: Total dû + Valider */}
        {draft && (
          <div
            className="relative overflow-hidden rounded-[24px] border p-[22px_20px]"
            style={{ background: 'var(--hero)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <Eyebrow>Total dû · {artists.length} artiste{artists.length > 1 ? 's' : ''}</Eyebrow>
            <div
              className="roy-num text-[42px] font-bold mt-2 leading-none"
              style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}
            >
              {fmtEUR(totalDue)}
            </div>
            <button
              onClick={() => setShowValidate(true)}
              disabled={artists.length === 0}
              className="w-full mt-[18px] flex items-center justify-center gap-2 py-[14px] rounded-[14px] font-bold text-[13.5px] disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Valider le calcul
            </button>
          </div>
        )}

        {/* Artist breakdown */}
        {artists.length > 0 && (
          <div
            className="mt-[14px] rounded-[20px] border px-4 py-1.5"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
          >
            {artists.map((a, i) => {
              const net = parseFloat(a.net_payable);
              const ready = net > 0 && a.statement_status !== 'finalized';
              return (
                <div
                  key={a.artist_id}
                  className={`flex items-center gap-3 py-[13px] ${i < artists.length - 1 ? 'border-b' : ''}`}
                  style={i < artists.length - 1 ? { borderColor: 'var(--border)' } : undefined}
                >
                  <div
                    className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[11px] font-bold flex-none"
                    style={{
                      background: ready ? 'var(--accent-soft)' : 'var(--surface-2)',
                      color: ready ? 'var(--accent)' : 'var(--text-2)',
                    }}
                  >
                    {initials(a.artist_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {a.artist_name}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                      base {fmtEUR(a.gross)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="roy-num text-[13.5px] font-bold" style={{ color: 'var(--text)' }}>
                      {fmtEUR(net)}
                    </div>
                    <div className="text-[10px] mt-0.5 font-semibold" style={{ color: ready ? 'var(--accent)' : 'var(--text-2)' }}>
                      {ready ? 'Prêt' : 'À revoir'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!draft && (
          <div
            className="rounded-[20px] border p-8 text-center"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Aucun calcul en brouillon</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              Crée un nouveau royalty run depuis l'admin desktop.
            </div>
          </div>
        )}
      </div>

      {/* Validate confirmation sheet */}
      <Sheet open={showValidate} onClose={() => setShowValidate(false)}>
        <div className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>
          Valider le calcul {draft ? fmtPeriod(draft.period_start, draft.period_end) : ''}
        </div>
        <div className="text-[13px] mt-1.5 leading-[1.5]" style={{ color: 'var(--text-2)' }}>
          {fmtEUR(totalDue)} seront répartis sur {artists.length} artiste{artists.length > 1 ? 's' : ''} et leurs relevés générés. Cette action est définitive.
        </div>
        <div className="flex gap-2.5 mt-[18px]">
          <button
            onClick={() => setShowValidate(false)}
            className="flex-1 py-[15px] rounded-[14px] border text-[13.5px] font-semibold"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text)' }}
          >
            Annuler
          </button>
          <button
            onClick={handleValidate}
            disabled={validating}
            className="flex-[1.4] py-[15px] rounded-[14px] font-bold text-[13.5px] disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            {validating ? 'Validation...' : 'Valider & générer'}
          </button>
        </div>
      </Sheet>

      {/* Success sheet */}
      <Sheet open={showValidated} onClose={() => setShowValidated(false)}>
        <div className="text-center">
          <div
            className="w-[72px] h-[72px] rounded-full mx-auto flex items-center justify-center"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-xl font-bold tracking-[-0.02em] mt-[18px]" style={{ color: 'var(--text)' }}>
            Calcul validé
          </div>
          <div className="text-[13px] mt-1.5 leading-[1.5]" style={{ color: 'var(--text-2)' }}>
            {artists.length} relevé{artists.length > 1 ? 's' : ''} généré{artists.length > 1 ? 's' : ''} et notifié{artists.length > 1 ? 's' : ''} aux artistes.<br />
            Total réparti : {fmtEUR(totalDue)}.
          </div>
          <button
            onClick={() => setShowValidated(false)}
            className="w-full mt-[22px] py-[15px] rounded-[15px] font-bold text-sm"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            Terminé
          </button>
        </div>
      </Sheet>

      <AdminBottomNav />
    </div>
  );
}
