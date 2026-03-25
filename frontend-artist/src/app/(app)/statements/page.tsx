'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import {
  getStatements,
  getStatementDetail,
  requestPayment,
  Statement,
  StatementDetail,
} from '@/lib/api';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Brouillon', className: 'bg-secondary-200 text-secondary-700' },
  published: { label: 'Publié', className: 'bg-primary/20 text-primary' },
  paid: { label: 'Payé', className: 'bg-success/20 text-success' },
};

export default function StatementsPage() {
  const { artist, loading: authLoading } = useAuth();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded statement details
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, StatementDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  // Payment request
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (artist) {
      loadStatements();
    }
  }, [artist]);

  const loadStatements = async () => {
    try {
      const data = await getStatements();
      setStatements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('fr-FR', { style: 'currency', currency });
  };

  const sorted = useMemo(() => {
    return [...statements].sort(
      (a, b) => new Date(b.period_end).getTime() - new Date(a.period_end).getTime()
    );
  }, [statements]);

  const totalEarned = useMemo(
    () => statements.reduce((sum, s) => sum + parseFloat(s.gross_revenue), 0),
    [statements]
  );

  const totalPaid = useMemo(
    () =>
      statements
        .filter((s) => s.status === 'paid')
        .reduce((sum, s) => sum + parseFloat(s.net_payable), 0),
    [statements]
  );

  const balance = totalEarned - totalPaid;
  const currency = statements[0]?.currency || 'EUR';

  const toggleExpand = useCallback(
    async (id: string) => {
      if (expandedId === id) {
        setExpandedId(null);
        return;
      }

      setExpandedId(id);

      if (!details[id]) {
        setDetailLoading(id);
        try {
          const detail = await getStatementDetail(id);
          setDetails((prev) => ({ ...prev, [id]: detail }));
        } catch {
          // silently fail, user can retry
        } finally {
          setDetailLoading(null);
        }
      }
    },
    [expandedId, details]
  );

  const handleRequestPayment = async (statementId: string) => {
    setPaymentLoading(statementId);
    try {
      await requestPayment(statementId);
      setPaymentSuccess(statementId);
      setTimeout(() => setPaymentSuccess(null), 3000);
    } catch {
      // could show error toast
    } finally {
      setPaymentLoading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-content2 transition-colors">
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="font-semibold text-foreground">Relevés</h1>
        </div>
      </header>

      <main className="px-4 py-4 pb-24 space-y-4">
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Summary Card */}
        {statements.length > 0 && (
          <div className="bg-content1 border border-divider rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-secondary-500 mb-1">Total gagné</p>
                <p className="text-lg font-bold text-foreground">
                  {totalEarned.toLocaleString('fr-FR', { style: 'currency', currency })}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary-500 mb-1">Total payé</p>
                <p className="text-lg font-bold text-success">
                  {totalPaid.toLocaleString('fr-FR', { style: 'currency', currency })}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary-500 mb-1">Solde</p>
                <p className="text-lg font-bold text-primary">
                  {balance.toLocaleString('fr-FR', { style: 'currency', currency })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {statements.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-content2 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-secondary-500">Aucun relevé disponible</p>
          </div>
        )}

        {/* Statements List */}
        <div className="space-y-3">
          {sorted.map((statement) => {
            const isExpanded = expandedId === statement.id;
            const detail = details[statement.id];
            const isLoadingDetail = detailLoading === statement.id;
            const statusConfig = STATUS_CONFIG[statement.status] || STATUS_CONFIG.draft;
            const canRequestPayment =
              statement.status === 'published' && parseFloat(statement.net_payable) > 0;

            return (
              <div
                key={statement.id}
                className="bg-content1 border border-divider rounded-2xl overflow-hidden"
              >
                {/* Statement Header */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{statement.period_label}</p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusConfig.className}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Revenue breakdown */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-secondary-500">Brut</span>
                      <span className="text-foreground font-medium">
                        {formatCurrency(statement.gross_revenue, statement.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-500">Royalties</span>
                      <span className="text-foreground font-medium">
                        {formatCurrency(statement.artist_royalties, statement.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-500">Récoupé</span>
                      <span className="text-foreground font-medium">
                        {formatCurrency(statement.recouped, statement.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-500">Net</span>
                      <span className="text-success font-semibold">
                        {formatCurrency(statement.net_payable, statement.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => toggleExpand(statement.id)}
                      className="flex-1 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 py-2 rounded-xl transition-colors"
                    >
                      {isExpanded ? 'Masquer' : 'Voir détail'}
                    </button>

                    {canRequestPayment && (
                      <button
                        onClick={() => handleRequestPayment(statement.id)}
                        disabled={paymentLoading === statement.id || paymentSuccess === statement.id}
                        className="flex-1 text-sm font-medium text-white bg-success hover:bg-success/90 disabled:opacity-50 py-2 rounded-xl transition-colors"
                      >
                        {paymentLoading === statement.id ? (
                          <Spinner size="sm" color="white" />
                        ) : paymentSuccess === statement.id ? (
                          'Demande envoyée !'
                        ) : (
                          'Demander paiement'
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-divider bg-content2/50 p-4 space-y-4">
                    {isLoadingDetail && (
                      <div className="flex justify-center py-4">
                        <Spinner size="sm" color="primary" />
                      </div>
                    )}

                    {detail && (
                      <>
                        {/* Advance balance */}
                        {parseFloat(detail.advance_balance) !== 0 && (
                          <div className="bg-warning/10 border border-warning/20 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-sm font-medium text-warning">Avance restante</p>
                            </div>
                            <p className="text-sm text-foreground font-semibold">
                              {formatCurrency(detail.advance_balance, detail.currency)}
                            </p>
                          </div>
                        )}

                        {/* By release */}
                        {detail.releases.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-2">
                              Par sortie
                            </p>
                            <div className="space-y-2">
                              {detail.releases.map((rel) => (
                                <div
                                  key={rel.upc}
                                  className="flex items-center justify-between bg-content1 rounded-xl p-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground truncate">
                                      {rel.title}
                                    </p>
                                    <p className="text-xs text-secondary-400">
                                      {rel.track_count} titre{rel.track_count > 1 ? 's' : ''}
                                    </p>
                                  </div>
                                  <div className="text-right ml-3">
                                    <p className="text-sm font-semibold text-foreground">
                                      {formatCurrency(rel.gross, detail.currency)}
                                    </p>
                                    <p className="text-xs text-success">
                                      {formatCurrency(rel.artist_royalties, detail.currency)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* By source */}
                        {detail.sources.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-2">
                              Par plateforme
                            </p>
                            <div className="space-y-2">
                              {detail.sources.map((src) => (
                                <div
                                  key={src.source}
                                  className="flex items-center justify-between bg-content1 rounded-xl p-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground">
                                      {src.source_label}
                                    </p>
                                    <p className="text-xs text-secondary-400">
                                      {src.transaction_count.toLocaleString('fr-FR')} transaction{src.transaction_count > 1 ? 's' : ''}
                                    </p>
                                  </div>
                                  <div className="text-right ml-3">
                                    <p className="text-sm font-semibold text-foreground">
                                      {formatCurrency(src.gross, detail.currency)}
                                    </p>
                                    <p className="text-xs text-success">
                                      {formatCurrency(src.artist_royalties, detail.currency)}
                                    </p>
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
