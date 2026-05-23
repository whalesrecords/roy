'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import {
  getStatements,
  getStatementDetail,
  requestPayment,
  Statement,
  StatementDetail,
} from '@/lib/api';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function StatementsPage() {
  const { artist, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, StatementDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (artist) loadStatements();
  }, [artist]);

  const loadStatements = async () => {
    try {
      const data = await getStatements();
      setStatements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.error'));
    } finally {
      setLoading(false);
    }
  };

  const fmt = (value: string, currency = 'EUR') =>
    parseFloat(value).toLocaleString('fr-FR', { style: 'currency', currency });

  const sorted = useMemo(
    () => [...statements].sort((a, b) => new Date(b.period_end).getTime() - new Date(a.period_end).getTime()),
    [statements]
  );

  const currency = statements[0]?.currency || 'EUR';
  const totalGross = useMemo(() => statements.reduce((s, x) => s + parseFloat(x.gross_revenue), 0), [statements]);
  const totalNet = useMemo(() => statements.reduce((s, x) => s + parseFloat(x.net_payable), 0), [statements]);
  const totalPaid = useMemo(
    () => statements.filter(s => s.status === 'paid').reduce((s, x) => s + parseFloat(x.net_payable), 0),
    [statements]
  );

  const toggleExpand = useCallback(async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!details[id]) {
      setDetailLoading(id);
      try {
        const detail = await getStatementDetail(id);
        setDetails(prev => ({ ...prev, [id]: detail }));
      } catch { /* silently fail */ }
      finally { setDetailLoading(null); }
    }
  }, [expandedId, details]);

  const handleRequestPayment = async (statementId: string) => {
    setPaymentLoading(statementId);
    try {
      await requestPayment(statementId);
      setPaymentSuccess(statementId);
      setTimeout(() => setPaymentSuccess(null), 3000);
    } catch { /* could show error */ }
    finally { setPaymentLoading(null); }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Spinner size="lg" color="primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background safe-top">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-foreground">{t('nav.revenue')}</h1>
        </div>
      </header>

      <main className="px-4 py-4 pb-28 space-y-3 max-w-lg mx-auto">
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Summary */}
        {statements.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('statements.totalGross'), value: totalGross.toLocaleString('fr-FR', { style: 'currency', currency }), color: 'text-foreground' },
              { label: t('statements.totalNet'), value: totalNet.toLocaleString('fr-FR', { style: 'currency', currency }), color: 'text-foreground' },
              { label: t('statements.totalPaid'), value: totalPaid.toLocaleString('fr-FR', { style: 'currency', currency }), color: 'text-emerald-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-content1 border border-divider rounded-2xl p-3 text-center">
                <p className="text-[10px] text-default-500 mb-1">{label}</p>
                <p className={`text-xs font-bold ${color} leading-tight`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Shortcut to Dépenses */}
        <Link
          href="/expenses"
          className="flex items-center justify-between bg-content1 border border-divider rounded-2xl px-4 py-3 hover:bg-content2 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-danger/10 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Dépenses du label</p>
              <p className="text-[10px] text-default-400">Mastering, promo, distribution…</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Empty state */}
        {statements.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-content1 border border-divider rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-default-500 text-sm">{t('statements.noStatements')}</p>
          </div>
        )}

        {/* Statements list */}
        <div className="space-y-2">
          {sorted.map((statement) => {
            const isExpanded = expandedId === statement.id;
            const detail = details[statement.id];
            const isLoadingDetail = detailLoading === statement.id;
            const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
              draft: { label: t('statements.draft'), className: 'bg-default-100 text-default-600' },
              published: { label: t('statements.published'), className: 'bg-primary/15 text-primary' },
              paid: { label: t('payments.paid'), className: 'bg-emerald-500/15 text-emerald-500' },
            };
            const statusConfig = STATUS_CONFIG[statement.status] || STATUS_CONFIG.draft;
            const canRequestPayment = statement.status === 'published' && parseFloat(statement.net_payable) > 0;

            return (
              <div key={statement.id} className="bg-content1 border border-divider rounded-2xl overflow-hidden">
                {/* Header row */}
                <div className="px-4 pt-4 pb-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground text-sm">{statement.period_label}</p>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusConfig.className}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Revenue breakdown — 2 cols */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    {[
                      { label: t('statements.gross'), val: statement.gross_revenue },
                      { label: t('payments.royalties'), val: statement.artist_royalties },
                      { label: t('statements.recouped'), val: statement.recouped },
                    ].map(({ label, val }) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-default-500">{label}</span>
                        <span className="text-foreground font-medium">{fmt(val, statement.currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between">
                      <span className="text-default-500">Net</span>
                      <span className="text-emerald-400 font-semibold">{fmt(statement.net_payable, statement.currency)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleExpand(statement.id)}
                      className="flex-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 py-2 rounded-xl transition-colors"
                    >
                      {isExpanded ? t('statements.collapse') : t('statements.viewDetail')}
                    </button>
                    {canRequestPayment && (
                      <button
                        onClick={() => handleRequestPayment(statement.id)}
                        disabled={paymentLoading === statement.id || paymentSuccess === statement.id}
                        className="flex-1 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-500/90 disabled:opacity-50 py-2 rounded-xl transition-colors"
                      >
                        {paymentLoading === statement.id ? <Spinner size="sm" color="white" />
                          : paymentSuccess === statement.id ? t('statements.requestSent')
                          : t('statements.requestPayment')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-divider bg-content2/40 px-4 py-4 space-y-4">
                    {isLoadingDetail && <div className="flex justify-center py-4"><Spinner size="sm" color="primary" /></div>}

                    {detail && (
                      <>
                        {parseFloat(detail.advance_balance) !== 0 && (
                          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                              <p className="text-xs text-amber-400 font-medium">{t('statements.advanceRemaining')}</p>
                              <p className="text-sm text-foreground font-semibold">{fmt(detail.advance_balance, detail.currency)}</p>
                            </div>
                          </div>
                        )}

                        {detail.releases.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-default-400 uppercase tracking-wider mb-2">{t('statements.byRelease')}</p>
                            <div className="space-y-1.5">
                              {detail.releases.map(rel => (
                                <div key={rel.upc} className="flex items-center justify-between bg-content1 rounded-xl px-3 py-2.5">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground truncate">{rel.title}</p>
                                    <p className="text-[10px] text-default-400">{rel.track_count} titre{rel.track_count > 1 ? 's' : ''}</p>
                                  </div>
                                  <div className="text-right ml-3 shrink-0">
                                    <p className="text-sm font-semibold text-foreground">{fmt(rel.gross, detail.currency)}</p>
                                    <p className="text-[10px] text-emerald-400">{fmt(rel.artist_royalties, detail.currency)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {detail.sources.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-default-400 uppercase tracking-wider mb-2">{t('statements.byPlatform')}</p>
                            <div className="space-y-1.5">
                              {detail.sources.map(src => (
                                <div key={src.source} className="flex items-center justify-between bg-content1 rounded-xl px-3 py-2.5">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground">{src.source_label}</p>
                                    <p className="text-[10px] text-default-400">{src.transaction_count.toLocaleString('fr-FR')} transaction{src.transaction_count > 1 ? 's' : ''}</p>
                                  </div>
                                  <div className="text-right ml-3 shrink-0">
                                    <p className="text-sm font-semibold text-foreground">{fmt(src.gross, detail.currency)}</p>
                                    <p className="text-[10px] text-emerald-400">{fmt(src.artist_royalties, detail.currency)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
