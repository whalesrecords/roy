'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getContracts, Contract } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const SCOPE_COLORS: Record<string, { color: string; bg: string }> = {
  catalog: { color: 'text-primary', bg: 'bg-primary/10' },
  release: { color: 'text-amber-500', bg: 'bg-amber-500/10' },
  track: { color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
};

function getScopeColors(scope: string) {
  return SCOPE_COLORS[scope] || { color: 'text-default-500', bg: 'bg-default-100' };
}

function isActive(contract: Contract): boolean {
  if (!contract.end_date) return true;
  return new Date(contract.end_date) > new Date();
}

export default function ContractsPage() {
  const { artist, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (artist) loadContracts();
  }, [artist]);

  const loadContracts = async () => {
    try {
      const data = await getContracts();
      setContracts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const sortedContracts = useMemo(
    () => [...contracts].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()),
    [contracts]
  );

  const activeCount = useMemo(() => contracts.filter(isActive).length, [contracts]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Spinner size="lg" color="primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background safe-top">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/" className="p-2 -ml-2 rounded-xl hover:bg-content1 transition-colors">
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="font-semibold text-foreground text-sm">{t('contracts.title')}</h1>
            <p className="text-[10px] text-default-400">{t('contracts.subtitle')}</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-28 max-w-lg mx-auto space-y-4">
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Summary */}
        {contracts.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-content1 border border-divider rounded-2xl p-3 text-center">
              <p className="text-[10px] text-default-500 mb-1">{t('contracts.total')}</p>
              <p className="text-2xl font-bold text-foreground">{contracts.length}</p>
            </div>
            <div className="bg-content1 border border-divider rounded-2xl p-3 text-center">
              <p className="text-[10px] text-default-500 mb-1">{t('contracts.activeCount')}</p>
              <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {sortedContracts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-content1 border border-divider rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-default-500 text-sm">{t('contracts.noContracts')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedContracts.map(contract => {
              const active = isActive(contract);
              const scope = getScopeColors(contract.scope);
              const PARTY_LABELS: Record<string, string> = {
                manager: 'Manager', booker: 'Booker', agent: 'Agent', publisher: 'Publisher', other: 'Other',
              };
              const PARTY_COLORS: Record<string, string> = {
                manager: 'bg-amber-500/10 text-amber-500',
                booker: 'bg-default-100 text-default-600',
                agent: 'bg-danger/10 text-danger',
                publisher: 'bg-cyan-500/10 text-cyan-500',
                other: 'bg-default-100 text-default-500',
              };

              return (
                <div
                  key={contract.id}
                  className={`bg-content1 border border-divider rounded-2xl p-4 space-y-4 ${!active && 'opacity-60'}`}
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-2.5 py-1 ${scope.bg} ${scope.color} text-xs font-semibold rounded-full shrink-0`}>
                        {t('contracts.' + contract.scope)}
                      </span>
                      {contract.scope_title && (
                        <span className="text-sm font-medium text-foreground truncate">{contract.scope_title}</span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full shrink-0 ${
                      active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-default-100 text-default-500'
                    }`}>
                      {active ? t('contracts.active') : t('contracts.expired')}
                    </span>
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-2 text-xs text-default-500">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatDate(contract.start_date)} → {contract.end_date ? formatDate(contract.end_date) : t('contracts.ongoing')}</span>
                  </div>

                  {/* Split bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-emerald-500">{t('contracts.artistShare')} {contract.artist_share}%</span>
                      <span className="text-default-400">{t('contracts.labelShare')} {contract.label_share}%</span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-default-100">
                      <div className="bg-emerald-500 rounded-l-full" style={{ width: `${contract.artist_share}%` }} />
                      <div className="bg-default-200 rounded-r-full flex-1" />
                    </div>
                  </div>

                  {/* Team */}
                  {contract.parties && contract.parties.filter(p => !['artist', 'label'].includes(p.party_type)).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-default-400 uppercase tracking-wider">{t('contracts.team')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {contract.parties.filter(p => !['artist', 'label'].includes(p.party_type)).map((p, i) => (
                          <div key={i} className={`px-2.5 py-1 rounded-xl text-xs ${PARTY_COLORS[p.party_type] || PARTY_COLORS.other}`}>
                            <span className="font-semibold">{PARTY_LABELS[p.party_type] || p.party_type}</span>
                            {p.label_name && <span className="ml-1 opacity-75">— {p.label_name}</span>}
                            <span className="ml-1 opacity-60">({(parseFloat(p.share_percentage) * 100).toFixed(0)}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {contract.description && (
                    <p className="text-xs text-default-400 italic">{contract.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
