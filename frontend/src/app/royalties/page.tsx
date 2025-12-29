'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { RoyaltyRun, ROYALTY_STATUS_LABELS, ROYALTY_STATUS_COLORS, Artist, ImportRecord } from '@/lib/types';
import { getRoyaltyRuns, createRoyaltyRun, lockRoyaltyRun, getArtists, getImports } from '@/lib/api';

export default function RoyaltiesPage() {
  const [runs, setRuns] = useState<RoyaltyRun[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [hasImports, setHasImports] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRun, setSelectedRun] = useState<RoyaltyRun | null>(null);

  // Create form
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [creating, setCreating] = useState(false);
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [runsData, artistsData, importsData] = await Promise.all([
        getRoyaltyRuns(),
        getArtists(),
        getImports(),
      ]);
      setRuns(runsData);
      setArtists(artistsData);
      setImports(importsData);
      setHasImports(importsData.length > 0);

      // Auto-fill period from most recent import
      if (importsData.length > 0 && !periodStart && !periodEnd) {
        const latestImport = importsData[0]; // Already sorted by date desc
        if (latestImport.period_start) setPeriodStart(latestImport.period_start);
        if (latestImport.period_end) setPeriodEnd(latestImport.period_end);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!periodStart || !periodEnd) return;
    setCreating(true);
    setError(null);
    try {
      const run = await createRoyaltyRun(periodStart, periodEnd, 'EUR');
      setShowCreate(false);
      setPeriodStart('');
      setPeriodEnd('');
      setSelectedRun(run);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de création');
    } finally {
      setCreating(false);
    }
  };

  const handleLock = async (runId: string) => {
    setLocking(true);
    try {
      const updated = await lockRoyaltyRun(runId);
      setSelectedRun(updated);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de verrouillage');
    } finally {
      setLocking(false);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('fr-FR', { style: 'currency', currency });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  };

  const canCalculate = hasImports && artists.length > 0;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Royalties</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Calculez et gérez les royalties par période
            </p>
          </div>
          {canCalculate && (
            <Button onClick={() => setShowCreate(true)}>
              <svg className="w-5 h-5 mr-2 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Calculer
            </Button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 text-red-600 rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Prerequisites check */}
        {!loading && (!hasImports || artists.length === 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <h3 className="font-medium text-amber-800 mb-2">Avant de calculer les royalties</h3>
            <ul className="space-y-2 text-sm text-amber-700">
              {!hasImports && (
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Importez des données de ventes</span>
                  <Link href="/imports" className="underline font-medium">→ Imports</Link>
                </li>
              )}
              {artists.length === 0 && (
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Activez des artistes avec leurs contrats</span>
                  <Link href="/artists" className="underline font-medium">→ Artistes</Link>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Stats summary */}
        {!loading && (hasImports || artists.length > 0) && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <p className="text-sm text-neutral-500">Artistes actifs</p>
              <p className="text-2xl font-semibold text-neutral-900">{artists.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <p className="text-sm text-neutral-500">Calculs effectués</p>
              <p className="text-2xl font-semibold text-neutral-900">{runs.length}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-neutral-500">Chargement...</p>
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucun calcul</h3>
            <p className="text-neutral-500">
              {canCalculate
                ? 'Lancez un premier calcul de royalties'
                : 'Complétez les prérequis ci-dessus pour commencer'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <button
                key={run.run_id}
                onClick={() => setSelectedRun(run)}
                className="w-full text-left bg-white rounded-xl border border-neutral-200 p-4 hover:border-neutral-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-neutral-900">
                        {formatDate(run.period_start)} - {formatDate(run.period_end)}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROYALTY_STATUS_COLORS[run.status]}`}>
                        {ROYALTY_STATUS_LABELS[run.status]}
                      </span>
                      {run.is_locked && (
                        <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                    </div>
                    <p className="text-sm text-neutral-500">
                      {run.total_transactions.toLocaleString('fr-FR')} transactions · {run.artists?.length || 0} artistes
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">{formatCurrency(run.total_net_payable, run.base_currency)}</p>
                    <p className="text-sm text-neutral-500">à payer</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="px-4 py-4 sm:px-6 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900">Calculer les royalties</h2>
                <button onClick={() => setShowCreate(false)} className="p-2 -mr-2 text-neutral-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="bg-neutral-50 rounded-lg p-3">
                <p className="text-sm text-neutral-600">
                  <strong>{artists.length} artiste{artists.length > 1 ? 's' : ''}</strong> actif{artists.length > 1 ? 's' : ''} avec contrat.
                  Les transactions de la période seront analysées et les royalties calculées selon les contrats.
                </p>
              </div>

              {/* Quick period selection from imports */}
              {imports.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Sélectionner une période importée
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {imports
                      .filter((imp, idx, arr) =>
                        arr.findIndex(i =>
                          i.period_start === imp.period_start && i.period_end === imp.period_end
                        ) === idx
                      )
                      .slice(0, 6)
                      .map((imp) => (
                        <button
                          key={imp.id}
                          type="button"
                          onClick={() => {
                            if (imp.period_start) setPeriodStart(imp.period_start);
                            if (imp.period_end) setPeriodEnd(imp.period_end);
                          }}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            periodStart === imp.period_start && periodEnd === imp.period_end
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          {formatDate(imp.period_start)} - {formatDate(imp.period_end)}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="date"
                  label="Début de période"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
                <Input
                  type="date"
                  label="Fin de période"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-neutral-100 flex gap-3">
              <Button variant="secondary" onClick={() => setShowCreate(false)} className="flex-1">
                Annuler
              </Button>
              <Button onClick={handleCreate} loading={creating} disabled={!periodStart || !periodEnd} className="flex-1">
                Calculer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRun && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-4 py-4 sm:px-6 border-b border-neutral-100 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">
                    {formatDate(selectedRun.period_start)} - {formatDate(selectedRun.period_end)}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROYALTY_STATUS_COLORS[selectedRun.status]}`}>
                      {ROYALTY_STATUS_LABELS[selectedRun.status]}
                    </span>
                    {selectedRun.is_locked && (
                      <span className="text-xs text-neutral-500">Verrouillé</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedRun(null)} className="p-2 -mr-2 text-neutral-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-sm text-neutral-500">Brut total</p>
                  <p className="text-lg font-semibold">{formatCurrency(selectedRun.total_gross, selectedRun.base_currency)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-sm text-green-600">Net à payer</p>
                  <p className="text-lg font-semibold text-green-700">{formatCurrency(selectedRun.total_net_payable, selectedRun.base_currency)}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-sm text-neutral-500">Part artistes</p>
                  <p className="text-lg font-semibold">{formatCurrency(selectedRun.total_artist_royalties, selectedRun.base_currency)}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-sm text-neutral-500">Recoupé</p>
                  <p className="text-lg font-semibold">{formatCurrency(selectedRun.total_recouped, selectedRun.base_currency)}</p>
                </div>
              </div>

              <div className="bg-neutral-50 rounded-lg p-3">
                <p className="text-sm text-neutral-500">Transactions traitées</p>
                <p className="text-lg font-semibold">{selectedRun.total_transactions.toLocaleString('fr-FR')}</p>
              </div>

              {/* Artists breakdown */}
              {selectedRun.artists && selectedRun.artists.length > 0 && (
                <div>
                  <h3 className="font-medium text-neutral-900 mb-3">Détail par artiste</h3>
                  <div className="space-y-2">
                    {selectedRun.artists.map((artist) => (
                      <div key={artist.artist_id} className="bg-white border border-neutral-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-neutral-900">
                            {artist.artist_name || 'Artiste inconnu'}
                          </p>
                          <p className="font-medium text-green-600">{formatCurrency(artist.net_payable, selectedRun.base_currency)}</p>
                        </div>
                        <div className="flex items-center justify-between text-sm text-neutral-500">
                          <span>{artist.transaction_count.toLocaleString('fr-FR')} transactions</span>
                          <span>Brut: {formatCurrency(artist.gross, selectedRun.base_currency)}</span>
                        </div>
                        {parseFloat(artist.recouped) > 0 && (
                          <p className="text-sm text-orange-600 mt-1">
                            Recoupé: {formatCurrency(artist.recouped, selectedRun.base_currency)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRun.artists && selectedRun.artists.length === 0 && (
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-amber-700">
                    Aucun artiste trouvé pour cette période. Vérifiez que les artistes sont bien activés avec des contrats valides.
                  </p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-neutral-100 p-4 sm:p-6 flex gap-3">
              <Button variant="secondary" onClick={() => setSelectedRun(null)} className="flex-1">
                Fermer
              </Button>
              {selectedRun.status === 'completed' && !selectedRun.is_locked && (
                <Button onClick={() => handleLock(selectedRun.run_id)} loading={locking} className="flex-1">
                  Verrouiller
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
