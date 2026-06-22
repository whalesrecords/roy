'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import {
  getStatements, getStatementDetail, requestPayment,
  Statement, StatementDetail,
} from '@/lib/api';
import { Card, Eyebrow, Pill, Segmented, AccentButton, fmtMoney } from '@/components/roy/ui';
import { IconChevronRight, IconDownload } from '@/components/roy/icons';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function statusPill(status: string) {
  if (status === 'paid') return <Pill tone="accent">Payé</Pill>;
  if (status === 'draft') return <Pill tone="neutral">Brouillon</Pill>;
  return <Pill tone="neutral">Disponible</Pill>;
}

export default function StatementsPage() {
  const { artist, loading: authLoading } = useAuth();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, StatementDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!artist) return;
    getStatements()
      .then((data) => {
        setStatements(data);
        const ys = Array.from(new Set(data.map((s) => new Date(s.period_end).getFullYear()))).sort((a, b) => b - a);
        if (ys.length) setYear(ys[0]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [artist]);

  const years = useMemo(
    () => Array.from(new Set(statements.map((s) => new Date(s.period_end).getFullYear()))).sort((a, b) => b - a),
    [statements],
  );
  const filtered = useMemo(
    () => statements
      .filter((s) => year == null || new Date(s.period_end).getFullYear() === year)
      .sort((a, b) => new Date(b.period_end).getTime() - new Date(a.period_end).getTime()),
    [statements, year],
  );

  const currency = statements[0]?.currency || 'EUR';
  const totalGross = filtered.reduce((s, x) => s + parseFloat(x.gross_revenue), 0);
  const totalNet = filtered.reduce((s, x) => s + parseFloat(x.net_payable), 0);
  const totalPaid = filtered.filter((s) => s.status === 'paid').reduce((s, x) => s + parseFloat(x.net_payable), 0);

  const periodRange = (s: Statement) => {
    const a = new Date(s.period_start), b = new Date(s.period_end);
    return `${cap(a.toLocaleDateString('fr-FR', { month: 'long' }))} – ${cap(b.toLocaleDateString('fr-FR', { month: 'long' }))}`;
  };

  const toggleExpand = useCallback(async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!details[id]) {
      setDetailLoading(id);
      try {
        const detail = await getStatementDetail(id);
        setDetails((prev) => ({ ...prev, [id]: detail }));
      } catch { /* ignore */ }
      finally { setDetailLoading(null); }
    }
  }, [expandedId, details]);

  const handleRequest = async (id: string) => {
    setPaymentLoading(id);
    try {
      await requestPayment(id);
      setPaymentSuccess(id);
      setTimeout(() => setPaymentSuccess(null), 3000);
    } catch { /* ignore */ } finally { setPaymentLoading(null); }
  };

  const exportCsv = () => {
    const rows = [['Période', 'Brut', 'Net', 'Statut']];
    filtered.forEach((s) => rows.push([s.period_label, parseFloat(s.gross_revenue).toFixed(2), parseFloat(s.net_payable).toFixed(2), s.status]));
    const csv = rows.map((r) => r.join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `releves-${year || 'tous'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const yearOpts = years.map((y) => ({ value: y, label: String(y) }));

  const Detail = ({ id }: { id: string }) => {
    const d = details[id];
    if (detailLoading === id) return <div className="flex justify-center py-4"><Spinner size="sm" color="primary" /></div>;
    if (!d) return null;
    const canRequest = d.status === 'published' && parseFloat(d.net_payable) > 0;
    return (
      <div className="space-y-4">
        {d.releases.length > 0 && (
          <div>
            <Eyebrow className="text-[9.5px]">Par sortie</Eyebrow>
            <div className="mt-2 space-y-1.5">
              {d.releases.map((r) => (
                <div key={r.upc} className="flex items-center justify-between bg-surface rounded-xl px-3 py-2.5">
                  <span className="text-[13px] font-medium text-ink truncate">{r.title}</span>
                  <span className="roy-num text-[13px] font-semibold text-ink">{fmtMoney(r.gross, d.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {d.sources.length > 0 && (
          <div>
            <Eyebrow className="text-[9.5px]">Par plateforme</Eyebrow>
            <div className="mt-2 space-y-1.5">
              {d.sources.map((src) => (
                <div key={src.source} className="flex items-center justify-between bg-surface rounded-xl px-3 py-2.5">
                  <span className="text-[13px] font-medium text-ink">{src.source_label}</span>
                  <span className="roy-num text-[13px] font-semibold text-ink">{fmtMoney(src.gross, d.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {canRequest && (
          <AccentButton onClick={() => handleRequest(id)} disabled={paymentLoading === id || paymentSuccess === id}>
            {paymentLoading === id ? <Spinner size="sm" /> : paymentSuccess === id ? 'Demande envoyée ✓' : 'Demander un versement'}
          </AccentButton>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-app">
      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center justify-between px-7 py-[22px] border-b border-line">
        <div>
          <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">Relevés</div>
          <div className="text-[12.5px] text-ink-faint mt-0.5">Vos décomptes de royalties trimestriels</div>
        </div>
        <div className="flex items-center gap-3">
          {yearOpts.length > 0 && <Segmented options={yearOpts} value={year ?? years[0]} onChange={setYear} />}
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-[11px] border border-line-strong bg-surface px-3.5 py-2.5 text-[12.5px] font-semibold text-ink hover:bg-surface-2 transition-colors">
            <IconDownload size={15} /> Tout télécharger
          </button>
        </div>
      </div>

      <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-none mx-auto">
        {(authLoading || loading) ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" color="primary" /></div>
        ) : (<>
          {error && <div className="p-3 rounded-2xl bg-neg/10 border border-neg/20 text-neg text-sm mb-3">{error}</div>}

          {/* Mobile épuré summary */}
          <div className="lg:hidden">
            <Eyebrow>Net perçu · {year}</Eyebrow>
            <div className="roy-num text-[48px] font-bold text-ink leading-none mt-1.5">{fmtMoney(totalPaid, currency)}</div>
            <div className="text-[12.5px] text-ink-muted mt-2">{filtered.length} relevé{filtered.length > 1 ? 's' : ''} · {fmtMoney(totalGross, currency)} bruts</div>
            {yearOpts.length > 0 && <div className="mt-5"><Segmented options={yearOpts} value={year ?? years[0]} onChange={setYear} /></div>}
          </div>

          {/* Desktop épuré band */}
          <div className="hidden lg:flex items-end gap-10 mb-7">
            <div><Eyebrow>Net perçu · {year}</Eyebrow><div className="roy-num text-[42px] font-bold text-ink leading-none mt-1.5">{fmtMoney(totalPaid, currency)}</div></div>
            <div className="pb-1.5"><Eyebrow>Bruts</Eyebrow><div className="roy-num text-[22px] font-semibold text-ink-muted mt-2">{fmtMoney(totalGross, currency)}</div></div>
            <div className="pb-1.5"><Eyebrow>Relevés</Eyebrow><div className="roy-num text-[22px] font-semibold text-ink-muted mt-2">{filtered.length}</div></div>
          </div>

          {filtered.length === 0 && !error && (
            <div className="text-center py-16 text-ink-faint text-sm">Aucun relevé pour {year}</div>
          )}

          {/* Mobile list */}
          <div className="lg:hidden mt-4 flex flex-col gap-2.5">
            {filtered.map((s) => (
              <div key={s.id} className="bg-surface rounded-[16px] border border-line overflow-hidden">
                <button onClick={() => toggleExpand(s.id)} className="w-full flex items-center gap-3.5 p-4 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-ink">{s.period_label}</div>
                    <div className="text-[11.5px] text-ink-faint mt-0.5">{periodRange(s)}</div>
                  </div>
                  <div className="text-right">
                    <div className="roy-num text-[15px] font-bold text-ink">{fmtMoney(s.net_payable, s.currency)}</div>
                    <div className="mt-1 flex justify-end">{statusPill(s.status)}</div>
                  </div>
                  <IconChevronRight size={17} className={`text-ink-faint transition-transform ${expandedId === s.id ? 'rotate-90' : ''}`} />
                </button>
                {expandedId === s.id && <div className="border-t border-line bg-surface-2/40 p-4"><Detail id={s.id} /></div>}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          {filtered.length > 0 && (
            <Card padded={false} className="hidden lg:block overflow-hidden rounded-[18px]">
              <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_120px] px-6 py-3 border-b border-line roy-eyebrow text-[10px]">
                <span>Période</span><span className="text-right">Brut</span><span className="text-right">Net</span><span className="text-center">Statut</span><span className="text-right">Détail</span>
              </div>
              {filtered.map((s) => (
                <div key={s.id} className="border-b border-line last:border-0">
                  <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_120px] items-center px-6 py-4 hover:bg-surface-2 transition-colors">
                    <div><div className="text-[14px] font-semibold text-ink">{s.period_label}</div><div className="text-[11.5px] text-ink-faint mt-0.5">{periodRange(s)}</div></div>
                    <span className="text-right roy-num text-[13.5px] text-ink-muted">{fmtMoney(s.gross_revenue, s.currency)}</span>
                    <span className="text-right roy-num text-[13.5px] font-bold text-ink">{fmtMoney(s.net_payable, s.currency)}</span>
                    <span className="flex justify-center">{statusPill(s.status)}</span>
                    <span className="flex justify-end">
                      <button onClick={() => toggleExpand(s.id)} className="flex items-center gap-1.5 rounded-[9px] border border-line-strong bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-ink hover:bg-surface-2 transition-colors">
                        <IconChevronRight size={13} className={`transition-transform ${expandedId === s.id ? 'rotate-90' : ''}`} /> Détail
                      </button>
                    </span>
                  </div>
                  {expandedId === s.id && <div className="px-6 py-5 bg-surface-2/40 border-t border-line"><Detail id={s.id} /></div>}
                </div>
              ))}
            </Card>
          )}

          {/* Dépenses shortcut */}
          <Link href="/expenses" className="mt-3 lg:mt-4 flex items-center justify-between bg-surface border border-line rounded-2xl px-4 py-3.5 hover:bg-surface-2 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-2 flex items-center justify-center text-ink-muted shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              <div>
                <p className="text-[13.5px] font-semibold text-ink">Dépenses du label</p>
                <p className="text-[11px] text-ink-faint">Mastering, promo, distribution…</p>
              </div>
            </div>
            <IconChevronRight size={16} className="text-ink-faint" />
          </Link>
        </>)}
      </main>
    </div>
  );
}
