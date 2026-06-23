'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@heroui/react';
import { getStatements, getStatementDetail, Statement, StatementDetail } from '@/lib/api';
import { ArtistBottomNav } from '@/components/roy/ArtistBottomNav';
import { Sheet } from '@/components/roy/Sheet';

const fmtEUR = (s: string | number) => {
  const n = typeof s === 'string' ? parseFloat(s) : s;
  return (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  finalized: 'Finalisé',
  paid: 'Payé',
};

export default function MobileRelevesPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Statement | null>(null);
  const [detail, setDetail] = useState<StatementDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getStatements();
        setStatements(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    getStatementDetail(selected.id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [selected]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const totalNet = statements
    .filter(s => s.status === 'paid')
    .reduce((acc, s) => acc + parseFloat(s.net_payable), 0);

  return (
    <div className="min-h-screen pb-[124px]" style={{ background: 'var(--bg)' }}>
      <div className="px-5 pt-2 max-w-md mx-auto">
        <div className="py-2 mb-4">
          <h1 className="text-[22px] font-bold tracking-[-0.025em]" style={{ color: 'var(--text)' }}>Relevés</h1>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            Net perçu · {fmtEUR(totalNet)}
          </div>
        </div>

        {error && (
          <div className="mb-3 px-4 py-3 rounded-[12px] border border-line text-sm text-neg" style={{ background: 'var(--surface)' }}>
            {error}
          </div>
        )}

        {statements.length === 0 ? (
          <div className="mt-6 text-center text-sm" style={{ color: 'var(--text-3)' }}>Aucun relevé pour l'instant</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {statements.map(s => {
              const status = s.status.toLowerCase();
              const paid = status === 'paid';
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="flex items-center gap-3.5 rounded-[16px] border px-[17px] py-4 text-left transition-colors"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>{s.period_label}</div>
                    <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {new Date(s.period_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – {new Date(s.period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="roy-num text-[15px] font-bold" style={{ color: 'var(--text)' }}>{fmtEUR(s.net_payable)}</div>
                    <div className="text-[10.5px] mt-0.5 font-semibold" style={{ color: paid ? 'var(--accent)' : 'var(--text-2)' }}>
                      {STATUS_LABELS[status] || s.status}
                    </div>
                  </div>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-3)' }} className="flex-none">
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Statement detail sheet */}
      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <>
            <div className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>
              {selected.period_label}
            </div>
            <div className="text-[12.5px] mt-1" style={{ color: 'var(--text-3)' }}>
              {new Date(selected.period_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – {new Date(selected.period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="rounded-[20px] border p-[18px] mt-4" style={{ background: 'var(--hero)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>Revenus bruts</span>
                <span className="roy-num text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>{fmtEUR(selected.gross_revenue)}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>Part artiste</span>
                <span className="roy-num text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>{fmtEUR(selected.artist_royalties)}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>Recoupé</span>
                <span className="roy-num text-[13.5px] font-semibold" style={{ color: 'var(--text-2)' }}>−{fmtEUR(selected.recouped)}</span>
              </div>
              <div className="flex items-center justify-between pt-3">
                <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>Net perçu</span>
                <span className="roy-num text-lg font-bold" style={{ color: 'var(--accent)' }}>{fmtEUR(selected.net_payable)}</span>
              </div>
            </div>
            {loadingDetail && (
              <div className="mt-4 text-center text-sm" style={{ color: 'var(--text-3)' }}>Chargement du détail...</div>
            )}
            {detail && detail.releases.length > 0 && (
              <div className="mt-4 rounded-[16px] border px-4 py-1.5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="text-[12.5px] font-semibold py-3 border-b" style={{ color: 'var(--text)', borderColor: 'var(--border)' }}>
                  Par release ({detail.releases.length})
                </div>
                {detail.releases.slice(0, 5).map((r, i, arr) => (
                  <div
                    key={r.upc}
                    className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? 'border-b' : ''}`}
                    style={i < arr.length - 1 ? { borderColor: 'var(--border)' } : undefined}
                  >
                    <span className="text-[12px] truncate flex-1 mr-3" style={{ color: 'var(--text)' }}>{r.title}</span>
                    <span className="roy-num text-[12px] font-semibold" style={{ color: 'var(--text)' }}>{fmtEUR(r.artist_royalties)}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setSelected(null)}
              className="w-full mt-4 py-[14px] rounded-[14px] border text-[13.5px] font-semibold"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text)' }}
            >
              Fermer
            </button>
          </>
        )}
      </Sheet>

      <ArtistBottomNav />
    </div>
  );
}
