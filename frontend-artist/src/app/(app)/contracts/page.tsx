'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getContracts, Contract } from '@/lib/api';

const scopeConfig: Record<string, { label: string; color: string; bg: string }> = {
  catalog: { label: 'Catalogue', color: 'text-primary', bg: 'bg-primary/10' },
  release: { label: 'Release', color: 'text-warning', bg: 'bg-warning/10' },
  track: { label: 'Track', color: 'text-success', bg: 'bg-success/10' },
};

function getScopeStyle(scope: string) {
  return scopeConfig[scope] || { label: scope, color: 'text-secondary-600', bg: 'bg-secondary/10' };
}

function isActive(contract: Contract): boolean {
  if (!contract.end_date) return true;
  return new Date(contract.end_date) > new Date();
}

export default function ContractsPage() {
  const { artist, loading: authLoading } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (artist) {
      loadContracts();
    }
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const sortedContracts = useMemo(
    () =>
      [...contracts].sort(
        (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      ),
    [contracts]
  );

  const activeCount = useMemo(() => contracts.filter(isActive).length, [contracts]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!artist) {
    return null;
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
          <div>
            <h1 className="font-semibold text-foreground">Mes contrats</h1>
            <p className="text-xs text-secondary-500">Accords de partage des revenus</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 pb-24 space-y-6">
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background border border-divider rounded-2xl p-4">
            <p className="text-xs text-secondary-500 mb-1">Total contrats</p>
            <p className="text-2xl font-bold text-foreground">{contracts.length}</p>
          </div>
          <div className="bg-background border border-divider rounded-2xl p-4">
            <p className="text-xs text-secondary-500 mb-1">Contrats actifs</p>
            <p className="text-2xl font-bold text-success">{activeCount}</p>
          </div>
        </div>

        {/* Contracts list */}
        {sortedContracts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-content2 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📄</span>
            </div>
            <p className="text-secondary-500">Aucun contrat enregistré</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedContracts.map((contract) => {
              const active = isActive(contract);
              const scope = getScopeStyle(contract.scope);

              return (
                <div
                  key={contract.id}
                  className={`bg-background border rounded-2xl p-4 space-y-4 ${
                    active ? 'border-divider' : 'border-divider opacity-70'
                  }`}
                >
                  {/* Top row: scope badge + status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-3 py-1 ${scope.bg} ${scope.color} text-xs font-semibold rounded-full shrink-0`}>
                        {scope.label}
                      </span>
                      {contract.scope_title && (
                        <span className="text-sm font-medium text-foreground truncate">
                          {contract.scope_title}
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-0.5 text-xs font-medium rounded-full shrink-0 ${
                        active
                          ? 'bg-success/10 text-success'
                          : 'bg-secondary/10 text-secondary-500'
                      }`}
                    >
                      {active ? 'Actif' : 'Expiré'}
                    </span>
                  </div>

                  {/* Date range */}
                  <div className="flex items-center gap-2 text-sm text-secondary-500">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>
                      {formatDate(contract.start_date)} → {contract.end_date ? formatDate(contract.end_date) : 'En cours'}
                    </span>
                  </div>

                  {/* Split visualization */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-success">Artiste {contract.artist_share}%</span>
                      <span className="text-secondary-500">Label {contract.label_share}%</span>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden">
                      <div
                        className="bg-success rounded-l-full transition-all"
                        style={{ width: `${contract.artist_share}%` }}
                      />
                      <div
                        className="bg-secondary-300 rounded-r-full transition-all"
                        style={{ width: `${contract.label_share}%` }}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  {contract.description && (
                    <p className="text-xs text-secondary-500 italic">{contract.description}</p>
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
