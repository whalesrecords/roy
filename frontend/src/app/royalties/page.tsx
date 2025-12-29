'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardBody, Spinner } from '@heroui/react';
import Button from '@/components/ui/Button';
import { RoyaltyRun, ROYALTY_STATUS_LABELS, Artist, ImportRecord } from '@/lib/types';
import { getRoyaltyRuns, createRoyaltyRun, lockRoyaltyRun, deleteRoyaltyRun, getArtists, getImports } from '@/lib/api';

const ROYALTY_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  locked: 'bg-gray-100 text-gray-700',
};

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
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>([]);
  const [selectAllArtists, setSelectAllArtists] = useState(true);
  const [creating, setCreating] = useState(false);
  const [locking, setLocking] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

      if (importsData.length > 0 && !periodStart && !periodEnd) {
        const latestImport = importsData[0];
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
      const artistIds = selectAllArtists ? undefined : selectedArtistIds;
      const run = await createRoyaltyRun(periodStart, periodEnd, 'EUR', artistIds);
      setShowCreate(false);
      setPeriodStart('');
      setPeriodEnd('');
      setSelectedArtistIds([]);
      setSelectAllArtists(true);
      setSelectedRun(run);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de creation');
    } finally {
      setCreating(false);
    }
  };

  const toggleArtistSelection = (artistId: string) => {
    setSelectedArtistIds(prev =>
      prev.includes(artistId)
        ? prev.filter(id => id !== artistId)
        : [...prev, artistId]
    );
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

  const handleDelete = async (runId: string) => {
    if (!confirm('Supprimer ce calcul ?')) return;
    setDeleting(true);
    try {
      await deleteRoyaltyRun(runId);
      setSelectedRun(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression');
    } finally {
      setDeleting(false);
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
    <>
      <header className="bg-background border-b border-divider sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Royalties</h1>
            <p className="text-sm text-default-500 mt-0.5">Calculs par periode</p>
          </div>
          {canCalculate && (
            <Button onClick={() => setShowCreate(true)}>
              Nouveau calcul
            </Button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Prerequisites check */}
        {!loading && (!hasImports || artists.length === 0) && (
          <Card className="bg-amber-50 border border-amber-200">
            <CardBody className="p-4">
              <p className="font-medium text-amber-800 mb-3">Avant de calculer :</p>
              <div className="space-y-2">
                {!hasImports && (
                  <Link href="/imports" className="flex items-center justify-between p-3 bg-white/50 rounded-lg hover:bg-white/80">
                    <span className="text-sm text-amber-700">1. Importer des donnees TuneCore</span>
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
                {artists.length === 0 && (
                  <Link href="/artists" className="flex items-center justify-between p-3 bg-white/50 rounded-lg hover:bg-white/80">
                    <span className="text-sm text-amber-700">2. Activer des artistes avec contrats</span>
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {/* Stats */}
        {!loading && runs.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-default-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{runs.length}</p>
              <p className="text-xs text-default-500">Calculs</p>
            </div>
            <div className="bg-default-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{artists.length}</p>
              <p className="text-xs text-default-500">Artistes</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-green-700">
                {formatCurrency(runs.reduce((acc, r) => acc + parseFloat(r.total_net_payable), 0).toString())}
              </p>
              <p className="text-xs text-green-600">Total paye</p>
            </div>
          </div>
        )}

        {/* Runs list */}
        {loading ? (
          <div className="text-center py-12">
            <Spinner size="lg" />
            <p className="text-default-500 mt-3">Chargement...</p>
          </div>
        ) : runs.length === 0 ? (
          <Card>
            <CardBody className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-default-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">Aucun calcul</h3>
              <p className="text-sm text-default-500 mb-4">
                {canCalculate ? 'Lancez votre premier calcul' : 'Completez les prerequis'}
              </p>
              {canCalculate && (
                <Button onClick={() => setShowCreate(true)}>
                  Premier calcul
                </Button>
              )}
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <Card
                key={run.run_id}
                isPressable
                onClick={() => setSelectedRun(run)}
                shadow="sm"
              >
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-default-100 flex items-center justify-center">
                        <span className="text-sm font-semibold text-default-600">
                          {formatDate(run.period_start).split(' ')[0].toUpperCase().slice(0, 3)}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {formatDate(run.period_start)} - {formatDate(run.period_end)}
                          </p>
                          {run.is_locked && (
                            <svg className="w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          )}
                        </div>
                        <p className="text-sm text-default-500">
                          {run.total_transactions.toLocaleString('fr-FR')} tx · {run.artists?.length || 0} artistes
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(run.total_net_payable, run.base_currency)}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ROYALTY_STATUS_COLORS[run.status] || 'bg-default-100'}`}>
                        {ROYALTY_STATUS_LABELS[run.status]}
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Nouveau calcul</h2>
                <button onClick={() => setShowCreate(false)} className="p-2 -mr-2 text-default-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* Quick period selection */}
              {imports.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-default-700 mb-2">
                    Periodes importees
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
                          onClick={() => {
                            if (imp.period_start) setPeriodStart(imp.period_start);
                            if (imp.period_end) setPeriodEnd(imp.period_end);
                          }}
                          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                            periodStart === imp.period_start && periodEnd === imp.period_end
                              ? 'bg-neutral-900 text-white'
                              : 'bg-default-100 text-default-600 hover:bg-default-200'
                          }`}
                        >
                          {formatDate(imp.period_start)}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Date inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-default-700 mb-1">Debut</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full px-3 py-2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-default-700 mb-1">Fin</label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              </div>

              {/* Artist selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-default-700">Artistes</label>
                  <button
                    onClick={() => {
                      setSelectAllArtists(!selectAllArtists);
                      if (!selectAllArtists) setSelectedArtistIds([]);
                    }}
                    className="text-sm text-neutral-600 hover:text-neutral-900"
                  >
                    {selectAllArtists ? 'Choisir' : 'Tous'}
                  </button>
                </div>

                {selectAllArtists ? (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-sm text-blue-700">
                      {artists.length} artiste{artists.length > 1 ? 's' : ''} inclus
                    </p>
                  </div>
                ) : (
                  <div className="border border-divider rounded-lg max-h-48 overflow-y-auto">
                    {artists.map((artist) => (
                      <label
                        key={artist.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-default-50 cursor-pointer border-b border-divider last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedArtistIds.includes(artist.id)}
                          onChange={() => toggleArtistSelection(artist.id)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        {artist.image_url_small ? (
                          <Image
                            src={artist.image_url_small}
                            alt={artist.name}
                            width={28}
                            height={28}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-default-200 flex items-center justify-center text-xs font-medium text-default-600">
                            {artist.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm text-foreground">{artist.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-divider flex gap-3">
              <Button variant="secondary" onClick={() => setShowCreate(false)} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={handleCreate}
                loading={creating}
                disabled={!periodStart || !periodEnd || (!selectAllArtists && selectedArtistIds.length === 0)}
                className="flex-1"
              >
                Calculer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRun && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {formatDate(selectedRun.period_start)} - {formatDate(selectedRun.period_end)}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ROYALTY_STATUS_COLORS[selectedRun.status]}`}>
                      {ROYALTY_STATUS_LABELS[selectedRun.status]}
                    </span>
                    {selectedRun.is_locked && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-default-100 text-default-600">
                        Verrouille
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedRun(null)} className="p-2 -mr-2 text-default-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-default-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-default-500 mb-1">Brut</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(selectedRun.total_gross, selectedRun.base_currency)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-600 mb-1">Net a payer</p>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(selectedRun.total_net_payable, selectedRun.base_currency)}</p>
                </div>
                <div className="bg-default-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-default-500 mb-1">Part artistes</p>
                  <p className="font-semibold text-foreground">{formatCurrency(selectedRun.total_artist_royalties, selectedRun.base_currency)}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-amber-600 mb-1">Recoupe</p>
                  <p className="font-semibold text-amber-700">{formatCurrency(selectedRun.total_recouped, selectedRun.base_currency)}</p>
                </div>
              </div>

              <div className="bg-default-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{selectedRun.total_transactions.toLocaleString('fr-FR')}</p>
                <p className="text-sm text-default-500">transactions traitees</p>
              </div>

              {/* Artists breakdown */}
              {selectedRun.artists && selectedRun.artists.length > 0 && (
                <div>
                  <h3 className="font-medium text-foreground mb-3">Detail par artiste</h3>
                  <div className="space-y-2">
                    {selectedRun.artists.map((artist) => (
                      <div key={artist.artist_id} className="bg-default-50 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-default-200 flex items-center justify-center text-sm font-medium text-default-600">
                              {(artist.artist_name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{artist.artist_name || 'Inconnu'}</p>
                              <p className="text-xs text-default-500">
                                {artist.transaction_count.toLocaleString('fr-FR')} tx
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">{formatCurrency(artist.net_payable, selectedRun.base_currency)}</p>
                            {parseFloat(artist.recouped) > 0 && (
                              <p className="text-xs text-amber-600">-{formatCurrency(artist.recouped, selectedRun.base_currency)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRun.artists && selectedRun.artists.length === 0 && (
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-amber-700">Aucun artiste pour cette periode</p>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 border-t border-divider space-y-2">
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setSelectedRun(null)} className="flex-1">
                  Fermer
                </Button>
                {selectedRun.status === 'completed' && !selectedRun.is_locked && (
                  <Button
                    onClick={() => handleLock(selectedRun.run_id)}
                    loading={locking}
                    className="flex-1"
                  >
                    Verrouiller
                  </Button>
                )}
              </div>
              {!selectedRun.is_locked && (
                <button
                  onClick={() => handleDelete(selectedRun.run_id)}
                  disabled={deleting}
                  className="w-full py-2 text-sm text-red-600 hover:text-red-700"
                >
                  {deleting ? 'Suppression...' : 'Supprimer ce calcul'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
