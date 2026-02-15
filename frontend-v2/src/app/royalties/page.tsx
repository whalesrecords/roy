'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardBody, CardHeader, Spinner, Divider } from '@heroui/react';
import Button from '@/components/ui/Button';
import { RoyaltyRun, ROYALTY_STATUS_LABELS, Artist, ImportRecord } from '@/lib/types';
import { getRoyaltyRuns, createRoyaltyRun, lockRoyaltyRun, deleteRoyaltyRun, getArtists, getImports, getExportCsvUrl, getExportPdfUrl, downloadExport } from '@/lib/api';

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
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

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

  const handleExportCsv = async () => {
    if (!periodStart || !periodEnd) return;
    setExportingCsv(true);
    try {
      const url = getExportCsvUrl(periodStart, periodEnd);
      await downloadExport(url, `royalties_${periodStart}_${periodEnd}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur export CSV');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    if (!periodStart || !periodEnd) return;
    setExportingPdf(true);
    try {
      const url = getExportPdfUrl(periodStart, periodEnd);
      // Open PDF in new tab for print
      const res = await fetch(url, {
        headers: { 'X-Admin-Token': process.env.NEXT_PUBLIC_ADMIN_TOKEN || '' },
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur export PDF');
    } finally {
      setExportingPdf(false);
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

  const handleDelete = async (runId: string, isLocked: boolean) => {
    const message = isLocked
      ? 'ATTENTION: Ce calcul est verrouille. La suppression est irreversible et supprimera toutes les donnees associees. Continuer ?'
      : 'Supprimer ce calcul ?';
    if (!confirm(message)) return;

    setDeleting(true);
    try {
      await deleteRoyaltyRun(runId, isLocked);
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

  const formatPeriod = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    if (s.getFullYear() === e.getFullYear()) {
      if (s.getMonth() === e.getMonth()) {
        return new Date(start).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      }
      return `${s.toLocaleDateString('fr-FR', { month: 'short' })} - ${e.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`;
    }
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const canCalculate = hasImports && artists.length > 0;

  // Group runs by year
  const runsByYear = runs.reduce((acc, run) => {
    const year = new Date(run.period_end).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(run);
    return acc;
  }, {} as Record<number, RoyaltyRun[]>);

  const years = Object.keys(runsByYear).map(Number).sort((a, b) => b - a);

  // Calculate totals
  const totalNetPayable = runs.reduce((acc, r) => acc + parseFloat(r.total_net_payable), 0);
  const totalGross = runs.reduce((acc, r) => acc + parseFloat(r.total_gross), 0);
  const lockedRuns = runs.filter(r => r.is_locked).length;

  return (
    <>
      <header className="bg-background border-b border-divider sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Royalties</h1>
            <p className="text-sm text-secondary-500 mt-0.5">Calculs et paiements</p>
          </div>
          {canCalculate && (
            <Button onClick={() => setShowCreate(true)}>
              + Nouveau calcul
            </Button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-xl p-4">
            <p className="text-danger-700 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-danger-500 mt-1 hover:underline">
              Fermer
            </button>
          </div>
        )}

        {/* Prerequisites check */}
        {!loading && (!hasImports || artists.length === 0) && (
          <Card className="bg-warning-50 border border-warning-200">
            <CardBody className="p-4">
              <p className="font-medium text-warning-800 mb-3">Avant de calculer les royalties :</p>
              <div className="space-y-2">
                {!hasImports && (
                  <Link href="/imports" className="flex items-center justify-between p-3 bg-white/50 rounded-lg hover:bg-white/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-warning-200 flex items-center justify-center">
                        <span className="text-warning-700 font-bold">1</span>
                      </div>
                      <span className="text-sm text-warning-700">Importer des donnees de ventes</span>
                    </div>
                    <svg className="w-4 h-4 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
                {artists.length === 0 && (
                  <Link href="/artists" className="flex items-center justify-between p-3 bg-white/50 rounded-lg hover:bg-white/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-warning-200 flex items-center justify-center">
                        <span className="text-warning-700 font-bold">2</span>
                      </div>
                      <span className="text-sm text-warning-700">Activer des artistes avec contrats</span>
                    </div>
                    <svg className="w-4 h-4 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {/* Summary stats */}
        {!loading && runs.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-success-100">
              <CardBody className="p-4">
                <p className="text-xs text-success font-medium mb-1">Total net a payer</p>
                <p className="text-2xl font-bold text-success-700">{formatCurrency(totalNetPayable.toString())}</p>
                <p className="text-xs text-success-500 mt-1">{lockedRuns} calcul{lockedRuns > 1 ? 's' : ''} verrouille{lockedRuns > 1 ? 's' : ''}</p>
              </CardBody>
            </Card>
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-primary-100">
              <CardBody className="p-4">
                <p className="text-xs text-primary font-medium mb-1">Revenus bruts</p>
                <p className="text-2xl font-bold text-primary-700">{formatCurrency(totalGross.toString())}</p>
                <p className="text-xs text-primary-500 mt-1">{runs.length} calcul{runs.length > 1 ? 's' : ''} total</p>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Export section */}
        {!loading && canCalculate && (
          <Card>
            <CardBody className="p-4 space-y-3">
              <h3 className="font-medium text-foreground">Exporter un rapport</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-secondary-500 mb-1">Debut</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full px-3 py-2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-secondary-500 mb-1">Fin</label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              {/* Quick period buttons from imports */}
              {imports.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {imports
                    .filter((imp, idx, arr) =>
                      arr.findIndex(i =>
                        i.period_start === imp.period_start && i.period_end === imp.period_end
                      ) === idx
                    )
                    .slice(0, 6)
                    .map((imp) => (
                      <button
                        key={`exp-${imp.id}`}
                        onClick={() => {
                          if (imp.period_start) setPeriodStart(imp.period_start);
                          if (imp.period_end) setPeriodEnd(imp.period_end);
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                          periodStart === imp.period_start && periodEnd === imp.period_end
                            ? 'bg-primary text-white'
                            : 'bg-content2 text-secondary-600 hover:bg-content3'
                        }`}
                      >
                        {formatDate(imp.period_start)}
                      </button>
                    ))}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleExportCsv}
                  disabled={!periodStart || !periodEnd || exportingCsv}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-content2 hover:bg-content3 disabled:opacity-40 rounded-xl text-sm font-medium text-foreground transition-colors"
                >
                  {exportingCsv ? (
                    <Spinner size="sm" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  CSV
                </button>
                <button
                  onClick={handleExportPdf}
                  disabled={!periodStart || !periodEnd || exportingPdf}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-content2 hover:bg-content3 disabled:opacity-40 rounded-xl text-sm font-medium text-foreground transition-colors"
                >
                  {exportingPdf ? (
                    <Spinner size="sm" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  )}
                  PDF
                </button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Runs list grouped by year */}
        {loading ? (
          <div className="text-center py-12">
            <Spinner size="lg" />
            <p className="text-secondary-500 mt-3">Chargement...</p>
          </div>
        ) : runs.length === 0 ? (
          <Card>
            <CardBody className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-content2 flex items-center justify-center">
                <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">Aucun calcul</h3>
              <p className="text-sm text-secondary-500 mb-4">
                {canCalculate ? 'Lancez votre premier calcul de royalties' : 'Completez les prerequis ci-dessus'}
              </p>
              {canCalculate && (
                <Button onClick={() => setShowCreate(true)}>
                  Premier calcul
                </Button>
              )}
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-6">
            {years.map((year) => (
              <div key={year}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-lg font-semibold text-foreground">{year}</h2>
                  <div className="flex-1 h-px bg-divider"></div>
                  <span className="text-sm text-secondary-500">
                    {formatCurrency(runsByYear[year].reduce((acc, r) => acc + parseFloat(r.total_net_payable), 0).toString())}
                  </span>
                </div>
                <div className="space-y-2">
                  {runsByYear[year].map((run) => (
                    <Card
                      key={run.run_id}
                      isPressable
                      onClick={() => setSelectedRun(run)}
                      className="border border-divider hover:border-default-400 transition-colors"
                    >
                      <CardBody className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Period indicator */}
                          <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ${
                            run.is_locked ? 'bg-content2' : 'bg-primary-50'
                          }`}>
                            {run.is_locked ? (
                              <svg className="w-6 h-6 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            ) : (
                              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground">
                              {formatPeriod(run.period_start, run.period_end)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-secondary-500">
                                {run.artists?.length || 0} artiste{(run.artists?.length || 0) > 1 ? 's' : ''}
                              </span>
                              <span className="text-default-300">·</span>
                              <span className="text-xs text-secondary-500">
                                {run.total_transactions.toLocaleString('fr-FR')} transactions
                              </span>
                            </div>
                          </div>

                          {/* Amount */}
                          <div className="text-right">
                            <p className="text-lg font-bold text-success">
                              {formatCurrency(run.total_net_payable, run.base_currency)}
                            </p>
                            <p className="text-xs text-secondary-400">
                              sur {formatCurrency(run.total_gross, run.base_currency)} brut
                            </p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Nouveau calcul</h2>
                <button onClick={() => setShowCreate(false)} className="p-2 -mr-2 text-secondary-500 hover:text-secondary-700">
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
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Periodes disponibles
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
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            periodStart === imp.period_start && periodEnd === imp.period_end
                              ? 'bg-primary text-white'
                              : 'bg-content2 text-secondary-600 hover:bg-content3'
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
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Debut</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full px-3 py-2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Fin</label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Artist selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-secondary-700">Artistes</label>
                  <button
                    onClick={() => {
                      setSelectAllArtists(!selectAllArtists);
                      if (!selectAllArtists) setSelectedArtistIds([]);
                    }}
                    className="text-sm text-primary hover:underline"
                  >
                    {selectAllArtists ? 'Choisir' : 'Tous'}
                  </button>
                </div>

                {selectAllArtists ? (
                  <div className="bg-primary-50 rounded-lg p-3">
                    <p className="text-sm text-primary-700">
                      Tous les {artists.length} artiste{artists.length > 1 ? 's' : ''} seront inclus
                    </p>
                  </div>
                ) : (
                  <div className="border border-divider rounded-lg max-h-48 overflow-y-auto">
                    {artists.map((artist) => (
                      <label
                        key={artist.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-content2 cursor-pointer border-b border-divider last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedArtistIds.includes(artist.id)}
                          onChange={() => toggleArtistSelection(artist.id)}
                          className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary"
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
                          <div className="w-7 h-7 rounded-full bg-content3 flex items-center justify-center text-xs font-medium text-secondary-600">
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {formatPeriod(selectedRun.period_start, selectedRun.period_end)}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedRun.is_locked && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-content2 text-secondary-600">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Verrouille
                      </span>
                    )}
                    {!selectedRun.is_locked && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning-100 text-warning-700">
                        Non verrouille
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedRun(null)} className="p-2 -mr-2 text-secondary-500 hover:text-secondary-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-content2 rounded-xl p-4">
                  <p className="text-xs text-secondary-500 mb-1">Revenus bruts</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(selectedRun.total_gross, selectedRun.base_currency)}</p>
                </div>
                <div className="bg-success-50 rounded-xl p-4">
                  <p className="text-xs text-success mb-1">Net a payer</p>
                  <p className="text-xl font-bold text-success-700">{formatCurrency(selectedRun.total_net_payable, selectedRun.base_currency)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-content2 rounded-lg p-3 text-center">
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(selectedRun.total_artist_royalties, selectedRun.base_currency)}</p>
                  <p className="text-xs text-secondary-500">Part artistes</p>
                </div>
                <div className="bg-content2 rounded-lg p-3 text-center">
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(selectedRun.total_label_royalties, selectedRun.base_currency)}</p>
                  <p className="text-xs text-secondary-500">Part label</p>
                </div>
                <div className="bg-warning-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-semibold text-warning-700">{formatCurrency(selectedRun.total_recouped, selectedRun.base_currency)}</p>
                  <p className="text-xs text-warning-600">Recoupe</p>
                </div>
              </div>

              <div className="bg-content2 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-foreground">{selectedRun.total_transactions.toLocaleString('fr-FR')}</p>
                <p className="text-sm text-secondary-500">transactions traitees</p>
              </div>

              {/* Artists breakdown */}
              {selectedRun.artists && selectedRun.artists.length > 0 && (
                <div>
                  <h3 className="font-medium text-foreground mb-3">Detail par artiste</h3>
                  <div className="space-y-2">
                    {selectedRun.artists.map((artist) => (
                      <div key={artist.artist_id} className="bg-content2 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-content3 flex items-center justify-center text-sm font-medium text-secondary-600">
                              {(artist.artist_name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{artist.artist_name || 'Inconnu'}</p>
                              <p className="text-xs text-secondary-500">
                                {artist.transaction_count.toLocaleString('fr-FR')} transactions
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-success">{formatCurrency(artist.net_payable, selectedRun.base_currency)}</p>
                            {parseFloat(artist.recouped) > 0 && (
                              <p className="text-xs text-warning-600">-{formatCurrency(artist.recouped, selectedRun.base_currency)} recoupe</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRun.artists && selectedRun.artists.length === 0 && (
                <div className="bg-warning-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-warning-700">Aucun artiste pour cette periode</p>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 border-t border-divider space-y-3">
              {/* Actions */}
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

              {/* Delete button - always visible */}
              <button
                onClick={() => handleDelete(selectedRun.run_id, selectedRun.is_locked)}
                disabled={deleting}
                className={`w-full py-2.5 text-sm rounded-lg transition-colors ${
                  selectedRun.is_locked
                    ? 'text-danger bg-danger-50 hover:bg-danger-100'
                    : 'text-danger hover:text-danger-700 hover:bg-danger-50'
                }`}
              >
                {deleting ? 'Suppression...' : selectedRun.is_locked ? 'Supprimer (verrouille)' : 'Supprimer ce calcul'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
