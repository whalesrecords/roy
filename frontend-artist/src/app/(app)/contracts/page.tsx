'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import { getContracts, Contract } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, Eyebrow, Pill } from '@/components/roy/ui';
import { IconCalendar, IconContract } from '@/components/roy/icons';

const SCOPE_TONE: Record<string, 'accent' | 'neutral'> = {
  catalog: 'accent',
  release: 'neutral',
  track: 'neutral',
};

function getScopeTone(scope: string): 'accent' | 'neutral' {
  return SCOPE_TONE[scope] || 'neutral';
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

  const PARTY_LABELS: Record<string, string> = {
    manager: 'Manager', booker: 'Booker', agent: 'Agent', publisher: 'Publisher', other: 'Other',
  };

  return (
    <div className="min-h-screen bg-app">
      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center justify-between px-7 py-[22px] border-b border-line">
        <div>
          <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">Contrats</div>
          <div className="text-[12.5px] text-ink-faint mt-0.5">Vos accords et répartitions de royalties</div>
        </div>
        {contracts.length > 0 && (
          <div className="flex items-center gap-7">
            <div className="text-right">
              <Eyebrow className="text-[9.5px]">{t('contracts.total')}</Eyebrow>
              <div className="roy-num text-[22px] font-bold text-ink leading-none mt-1.5">{contracts.length}</div>
            </div>
            <div className="text-right">
              <Eyebrow className="text-[9.5px]">{t('contracts.activeCount')}</Eyebrow>
              <div className="roy-num text-[22px] font-bold text-accent leading-none mt-1.5">{activeCount}</div>
            </div>
          </div>
        )}
      </div>

      <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-none mx-auto space-y-3 lg:space-y-4">
        {(authLoading || loading) ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" color="primary" />
          </div>
        ) : (
        <>
        {error && (
          <div className="p-3 rounded-2xl bg-neg/10 border border-neg/20 text-neg text-sm">{error}</div>
        )}

        {/* Mobile summary */}
        {contracts.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:hidden">
            <Card className="text-center">
              <Eyebrow className="text-[9.5px]">{t('contracts.total')}</Eyebrow>
              <div className="roy-num text-[30px] font-bold text-ink leading-none mt-2">{contracts.length}</div>
            </Card>
            <Card className="text-center">
              <Eyebrow className="text-[9.5px]">{t('contracts.activeCount')}</Eyebrow>
              <div className="roy-num text-[30px] font-bold text-accent leading-none mt-2">{activeCount}</div>
            </Card>
          </div>
        )}

        {/* Empty state */}
        {sortedContracts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-surface-2 border border-line rounded-[18px] flex items-center justify-center mx-auto mb-4 text-ink-faint">
              <IconContract size={24} />
            </div>
            <p className="text-ink-faint text-sm">{t('contracts.noContracts')}</p>
          </div>
        ) : (
          <div className="space-y-3 lg:space-y-4">
            {sortedContracts.map(contract => {
              const active = isActive(contract);
              const scopeTone = getScopeTone(contract.scope);
              const team = (contract.parties || []).filter(p => !['artist', 'label'].includes(p.party_type));

              return (
                <Card key={contract.id} className={`space-y-4 ${!active ? 'opacity-60' : ''}`}>
                  {/* Top row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Pill tone={scopeTone}>{t('contracts.' + contract.scope)}</Pill>
                      {contract.scope_title && (
                        <span className="text-[14px] font-semibold text-ink truncate">{contract.scope_title}</span>
                      )}
                    </div>
                    <Pill tone={active ? 'accent' : 'neutral'}>
                      {active ? t('contracts.active') : t('contracts.expired')}
                    </Pill>
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-2 text-[12px] text-ink-faint">
                    <IconCalendar size={15} className="shrink-0" />
                    <span>{formatDate(contract.start_date)} → {contract.end_date ? formatDate(contract.end_date) : t('contracts.ongoing')}</span>
                  </div>

                  {/* Split bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[12.5px] font-semibold">
                      <span className="text-accent">{t('contracts.artistShare')} <span className="roy-num">{contract.artist_share}%</span></span>
                      <span className="text-ink-faint">{t('contracts.labelShare')} <span className="roy-num">{contract.label_share}%</span></span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-track">
                      <div className="bg-accent rounded-l-full" style={{ width: `${contract.artist_share}%` }} />
                      <div className="bg-surface-2 rounded-r-full flex-1" />
                    </div>
                  </div>

                  {/* Team */}
                  {team.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <Eyebrow className="text-[9.5px]">{t('contracts.team')}</Eyebrow>
                      <div className="flex flex-wrap gap-1.5">
                        {team.map((p, i) => (
                          <div key={i} className="flex items-center gap-1 rounded-xl bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink-muted">
                            <span className="font-semibold text-ink">{PARTY_LABELS[p.party_type] || p.party_type}</span>
                            {p.label_name && <span className="text-ink-faint">— {p.label_name}</span>}
                            <span className="roy-num text-ink-faint">({(parseFloat(p.share_percentage) * 100).toFixed(0)}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {contract.description && (
                    <p className="text-[12px] text-ink-faint italic">{contract.description}</p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
        </>
        )}
      </main>
    </div>
  );
}
