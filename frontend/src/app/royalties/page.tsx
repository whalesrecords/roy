'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Spinner } from '@heroui/react';
import { RoyaltyRun, ROYALTY_STATUS_LABELS, Artist, ImportRecord, ArtistRoyaltyResult } from '@/lib/types';
import { getRoyaltyRuns, createRoyaltyRun, lockRoyaltyRun, deleteRoyaltyRun, payAllRoyaltyRun, getArtists, getImports, getExportCsvUrl, getExportPdfUrl, downloadExport } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { Card, Eyebrow, Pill, Avatar, AccentButton, OutlineButton } from '@/components/roy/ui';
import { IconRoyalty, IconCheck, IconPlus, IconChevronRight, IconDownload } from '@/components/roy/icons';

export default function RoyaltiesPage() {
  const [runs, setRuns] = useState<RoyaltyRun[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [hasImports, setHasImports] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRun, setSelectedRun] = useState<RoyaltyRun | null>(null);
  // In-app confirmation (replaces native confirm() for paiement/suppression).
  const [confirmAction, setConfirmAction] = useState<{
    title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);

  // Create form
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>([]);
  const [selectAllArtists, setSelectAllArtists] = useState(true);
  const [creating, setCreating] = useState(false);
  const [locking, setLocking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [payingAll, setPayingAll] = useState(false);
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
      // Token is injected server-side by /api/proxy — no client-side header needed
      const res = await fetch(url);
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

  const doPayAll = async (runId: string) => {
    setPayingAll(true);
    try {
      const updated = await payAllRoyaltyRun(runId);
      setSelectedRun(updated);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de paiement');
    } finally {
      setPayingAll(false);
    }
  };

  // Opens the confirmation modal with a clear récap before marking as paid.
  const handlePayAll = (run: RoyaltyRun) => {
    const n = run.artists?.filter(a => a.statement_status !== 'paid' && parseFloat(a.net_payable) > 0).length ?? 0;
    setConfirmAction({
      title: 'Marquer comme payé',
      message: `Marquer ${n} relevé${n > 1 ? 's' : ''} comme payé${n > 1 ? 's' : ''} — total ${formatCurrency(run.total_net_payable, run.base_currency)} ? Les paiements seront enregistrés dans le journal.`,
      confirmLabel: 'Marquer payé',
      onConfirm: () => doPayAll(run.run_id),
    });
  };

  const doDelete = async (runId: string, isLocked: boolean) => {
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

  const handleDelete = (run: RoyaltyRun) => {
    setConfirmAction({
      title: 'Supprimer ce calcul',
      message: run.is_locked
        ? 'Ce calcul est verrouillé. La suppression est définitive et effacera tous les relevés associés. Continuer ?'
        : 'Supprimer ce calcul ? Vous pourrez le relancer à tout moment.',
      confirmLabel: 'Supprimer',
      danger: true,
      onConfirm: () => doDelete(run.run_id, run.is_locked),
    });
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

  // Year filter (presentation only — defaults to the most recent year)
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const activeYear = selectedYear ?? years[0] ?? null;
  const visibleYears = activeYear != null ? [activeYear] : years;

  // Calculate totals
  const totalNetPayable = runs.reduce((acc, r) => acc + parseFloat(r.total_net_payable), 0);
  const lockedRuns = runs.filter(r => r.is_locked).length;

  // Featured run for the banner: selected run, else most-recent unlocked (draft/completed) run, else most-recent run.
  const featuredRun =
    selectedRun ??
    runs.find(r => !r.is_locked) ??
    runs[0] ??
    null;

  // Per-artist lines for the featured run.
  const featuredLines: ArtistRoyaltyResult[] = featuredRun?.artists ?? [];

  // Effective royalty rate for a line (artist_royalties / gross) — there is no explicit rate field.
  const lineRate = (line: ArtistRoyaltyResult): string => {
    const gross = parseFloat(line.gross);
    if (!gross) return '—';
    return `${((parseFloat(line.artist_royalties) / gross) * 100).toFixed(1)} %`;
  };

  // Whether a line is "ready" to pay/validate.
  const lineReady = (run: RoyaltyRun, line: ArtistRoyaltyResult): boolean =>
    line.statement_status === 'paid' ||
    line.statement_status === 'finalized' ||
    run.is_locked ||
    run.status === 'completed';

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div>
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Royalties</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">Calculs et paiements · {lockedRuns} verrouillé{lockedRuns > 1 ? 's' : ''} · {formatCurrency(totalNetPayable)} dus</p>
        </div>
        <div className="flex items-center gap-2.5">
          {years.length > 0 && (
            <div className="flex gap-1 rounded-[10px] border border-line bg-surface p-1">
              {years.slice(0, 3).map((y) => (
                <button key={y} onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1.5 rounded-[7px] text-[12px] font-${y === activeYear ? 'semibold' : 'medium'} ${y === activeYear ? 'bg-ink text-app' : 'text-ink-muted hover:text-ink'}`}>
                  {y}
                </button>
              ))}
            </div>
          )}
          {canCalculate && (
            <AccentButton onClick={() => setShowCreate(true)}><IconPlus size={14} /> Nouveau calcul</AccentButton>
          )}
        </div>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {error && (
          <Card className="border-neg/40">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-neg">{error}</p>
              <button onClick={() => setError(null)} className="text-[11px] text-ink-faint hover:text-ink">
                Fermer
              </button>
            </div>
          </Card>
        )}

        {/* Prerequisites check */}
        {!loading && (!hasImports || artists.length === 0) && (
          <Card>
            <Eyebrow>Avant de calculer les royalties</Eyebrow>
            <div className="space-y-2 mt-3">
              {!hasImports && (
                <Link href="/imports" className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 hover:bg-surface-2/70 transition-colors">
                  <div className="w-[34px] h-[34px] rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0 font-bold text-[13px]">1</div>
                  <span className="flex-1 text-[13px] font-semibold text-ink">Importer des données de ventes</span>
                  <IconChevronRight size={16} className="text-ink-faint" />
                </Link>
              )}
              {artists.length === 0 && (
                <Link href="/artists" className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 hover:bg-surface-2/70 transition-colors">
                  <div className="w-[34px] h-[34px] rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0 font-bold text-[13px]">2</div>
                  <span className="flex-1 text-[13px] font-semibold text-ink">Activer des artistes avec contrats</span>
                  <IconChevronRight size={16} className="text-ink-faint" />
                </Link>
              )}
            </div>
          </Card>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner size="lg" />
            <p className="text-[13px] text-ink-faint">Chargement...</p>
          </div>
        ) : runs.length === 0 ? (
          <Card className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-4 rounded-[12px] bg-accent-soft text-accent flex items-center justify-center">
              <IconRoyalty size={22} />
            </div>
            <h3 className="text-[15px] font-bold text-ink mb-1">Aucun calcul</h3>
            <p className="text-[12.5px] text-ink-faint mb-4">
              {canCalculate ? 'Lancez votre premier calcul de royalties' : 'Complétez les prérequis ci-dessus'}
            </p>
            {canCalculate && (
              <div className="flex justify-center">
                <AccentButton onClick={() => setShowCreate(true)}><IconPlus size={14} /> Premier calcul</AccentButton>
              </div>
            )}
          </Card>
        ) : (
          <>
            {/* ===== Featured "calcul en cours" banner ===== */}
            {featuredRun && (
              <Card hero className="flex flex-col sm:flex-row sm:items-center gap-3.5">
                <div className="flex-1 min-w-0">
                  <Eyebrow>Calcul en cours · {formatPeriod(featuredRun.period_start, featuredRun.period_end)}</Eyebrow>
                  <div className="roy-num text-[28px] font-bold text-ink mt-2">
                    {formatCurrency(featuredRun.total_net_payable, featuredRun.base_currency)}
                  </div>
                  <div className="text-[12px] text-ink-muted mt-1">
                    royalties dues · {featuredLines.length} artiste{featuredLines.length > 1 ? 's' : ''} · base {formatCurrency(featuredRun.total_gross, featuredRun.base_currency)}
                  </div>
                </div>
                <div className="flex items-center gap-3.5 shrink-0">
                  <Pill tone="neutral">{ROYALTY_STATUS_LABELS[featuredRun.status]}</Pill>
                  {featuredRun.status === 'completed' && !featuredRun.is_locked ? (
                    <AccentButton onClick={() => handleLock(featuredRun.run_id)} disabled={locking}>
                      {locking ? <Spinner size="sm" /> : <IconCheck size={14} />} Valider le calcul
                    </AccentButton>
                  ) : (
                    <OutlineButton onClick={() => setSelectedRun(featuredRun)}>
                      Détail <IconChevronRight size={14} />
                    </OutlineButton>
                  )}
                </div>
              </Card>
            )}

            {/* ===== Per-artist table for the featured run ===== */}
            <Card padded={false} className="overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1.8fr_1.1fr_0.8fr_1.1fr_1fr] px-[22px] py-3 border-b border-line roy-eyebrow text-[10px]">
                <span>Artiste</span>
                <span className="text-right">Base</span>
                <span className="text-right">Taux</span>
                <span className="text-right">Dû</span>
                <span className="text-center">Statut</span>
              </div>

              {featuredLines.length === 0 ? (
                <div className="px-[22px] py-10 text-center text-[13px] text-ink-faint">
                  Aucun artiste pour ce calcul
                </div>
              ) : (
                <>
                  {featuredLines.map((line, i) => {
                    const ready = lineReady(featuredRun!, line);
                    return (
                      <div
                        key={line.artist_id}
                        className="grid grid-cols-[1.8fr_1.1fr_0.8fr_1.1fr_1fr] items-center px-[22px] py-3.5 border-b border-line hover:bg-surface-2 transition-colors"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={line.artist_name || '?'} size={30} accent={i === 0} />
                          <span className="text-[13.5px] font-semibold text-ink truncate">{line.artist_name || 'Inconnu'}</span>
                        </span>
                        <span className="text-right roy-num text-[13px] text-ink-muted">{formatCurrency(line.gross, featuredRun!.base_currency)}</span>
                        <span className="text-right roy-num text-[13px] text-ink-muted">{lineRate(line)}</span>
                        <span className="text-right roy-num text-[13px] font-bold text-ink">{formatCurrency(line.net_payable, featuredRun!.base_currency)}</span>
                        <span className="flex justify-center">
                          <Pill tone={ready ? 'accent' : 'neutral'}>{ready ? 'Prêt' : 'À revoir'}</Pill>
                        </span>
                      </div>
                    );
                  })}

                  {/* Total row */}
                  <div className="grid grid-cols-[1.8fr_1.1fr_0.8fr_1.1fr_1fr] items-center px-[22px] py-3.5 bg-surface-2">
                    <span className="text-[13px] font-bold text-ink">Total · {featuredLines.length} artiste{featuredLines.length > 1 ? 's' : ''}</span>
                    <span className="text-right roy-num text-[13px] text-ink-muted">{formatCurrency(featuredRun!.total_gross, featuredRun!.base_currency)}</span>
                    <span />
                    <span className="text-right roy-num text-[13px] font-bold text-accent">{formatCurrency(featuredRun!.total_net_payable, featuredRun!.base_currency)}</span>
                    <span />
                  </div>
                </>
              )}
            </Card>

            {/* ===== Export report ===== */}
            {canCalculate && (
              <Card>
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-semibold text-ink">Exporter un rapport</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3.5">
                  <div>
                    <label className="block roy-eyebrow text-[10px] mb-1.5">Début</label>
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-[10px] border border-line bg-surface text-[13px] text-ink focus:outline-none focus:border-line-strong"
                    />
                  </div>
                  <div>
                    <label className="block roy-eyebrow text-[10px] mb-1.5">Fin</label>
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-[10px] border border-line bg-surface text-[13px] text-ink focus:outline-none focus:border-line-strong"
                    />
                  </div>
                </div>
                {/* Quick period buttons from imports */}
                {imports.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {imports
                      .filter((imp, idx, arr) =>
                        arr.findIndex(i =>
                          i.period_start === imp.period_start && i.period_end === imp.period_end
                        ) === idx
                      )
                      .slice(0, 6)
                      .map((imp) => {
                        const active = periodStart === imp.period_start && periodEnd === imp.period_end;
                        return (
                          <button
                            key={`exp-${imp.id}`}
                            onClick={() => {
                              if (imp.period_start) setPeriodStart(imp.period_start);
                              if (imp.period_end) setPeriodEnd(imp.period_end);
                            }}
                            className={`px-2.5 py-1 rounded-[8px] text-[11.5px] font-medium transition-colors ${
                              active ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-muted hover:text-ink'
                            }`}
                          >
                            {formatDate(imp.period_start)}
                          </button>
                        );
                      })}
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <OutlineButton onClick={handleExportCsv} className="flex-1 justify-center">
                    {exportingCsv ? <Spinner size="sm" /> : <IconDownload size={14} />} CSV
                  </OutlineButton>
                  <OutlineButton onClick={handleExportPdf} className="flex-1 justify-center">
                    {exportingPdf ? <Spinner size="sm" /> : <IconDownload size={14} />} PDF
                  </OutlineButton>
                </div>
              </Card>
            )}

            {/* ===== Runs list grouped by year ===== */}
            <div className="space-y-4">
              {visibleYears.map((year) => (
                <div key={year}>
                  <div className="flex items-center gap-3 mb-3">
                    <Eyebrow>{year}</Eyebrow>
                    <div className="flex-1 h-px bg-line" />
                    <span className="roy-num text-[12px] font-semibold text-ink-muted">
                      {formatCurrency(runsByYear[year].reduce((acc, r) => acc + parseFloat(r.total_net_payable), 0))}
                    </span>
                  </div>
                  <Card padded={false} className="overflow-hidden">
                    {runsByYear[year].map((run, i) => {
                      const allPaid = run.is_locked && run.artists?.length > 0 && run.artists.every(a => a.statement_status === 'paid' || parseFloat(a.net_payable) === 0);
                      return (
                        <button
                          key={run.run_id}
                          onClick={() => setSelectedRun(run)}
                          className={`w-full flex items-center gap-3.5 text-left px-[22px] py-3.5 hover:bg-surface-2 transition-colors ${i < runsByYear[year].length - 1 ? 'border-b border-line' : ''}`}
                        >
                          <div className="w-[34px] h-[34px] rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
                            <IconRoyalty size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13.5px] font-semibold text-ink">{formatPeriod(run.period_start, run.period_end)}</div>
                            <div className="text-[11.5px] text-ink-faint mt-0.5">
                              {run.artists?.length || 0} artiste{(run.artists?.length || 0) > 1 ? 's' : ''} · {formatNumber(run.total_transactions)} transactions
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="roy-num text-[14px] font-bold text-ink">{formatCurrency(run.total_net_payable, run.base_currency)}</div>
                            <div className="text-[11px] text-ink-faint mt-0.5">sur {formatCurrency(run.total_gross, run.base_currency)} brut</div>
                          </div>
                          <div className="shrink-0">
                            {allPaid
                              ? <Pill tone="accent"><IconCheck size={11} /> Payé</Pill>
                              : <Pill tone="neutral">{ROYALTY_STATUS_LABELS[run.status]}</Pill>}
                          </div>
                          <IconChevronRight size={16} className="text-ink-faint shrink-0" />
                        </button>
                      );
                    })}
                  </Card>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-surface w-full sm:max-w-md sm:rounded-[16px] rounded-t-[16px] max-h-[90vh] overflow-y-auto shadow-roy">
            <div className="px-5 py-4 border-b border-line">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-bold text-ink">Nouveau calcul</h2>
                <button onClick={() => setShowCreate(false)} className="p-2 -mr-2 text-ink-faint hover:text-ink">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Quick period selection */}
              {imports.length > 0 && (
                <div>
                  <label className="block roy-eyebrow text-[10px] mb-2">Périodes disponibles</label>
                  <div className="flex flex-wrap gap-2">
                    {imports
                      .filter((imp, idx, arr) =>
                        arr.findIndex(i =>
                          i.period_start === imp.period_start && i.period_end === imp.period_end
                        ) === idx
                      )
                      .slice(0, 6)
                      .map((imp) => {
                        const active = periodStart === imp.period_start && periodEnd === imp.period_end;
                        return (
                          <button
                            key={imp.id}
                            onClick={() => {
                              if (imp.period_start) setPeriodStart(imp.period_start);
                              if (imp.period_end) setPeriodEnd(imp.period_end);
                            }}
                            className={`px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium transition-colors ${
                              active ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-muted hover:text-ink'
                            }`}
                          >
                            {formatDate(imp.period_start)}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Date inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block roy-eyebrow text-[10px] mb-1.5">Début</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-[10px] border border-line bg-surface text-[13px] text-ink focus:outline-none focus:border-line-strong"
                  />
                </div>
                <div>
                  <label className="block roy-eyebrow text-[10px] mb-1.5">Fin</label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-[10px] border border-line bg-surface text-[13px] text-ink focus:outline-none focus:border-line-strong"
                  />
                </div>
              </div>

              {/* Artist selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="roy-eyebrow text-[10px]">Artistes</label>
                  <button
                    onClick={() => {
                      setSelectAllArtists(!selectAllArtists);
                      if (!selectAllArtists) setSelectedArtistIds([]);
                    }}
                    className="text-[12.5px] font-semibold text-accent hover:opacity-80"
                  >
                    {selectAllArtists ? 'Choisir' : 'Tous'}
                  </button>
                </div>

                {selectAllArtists ? (
                  <div className="bg-accent-soft rounded-[10px] p-3">
                    <p className="text-[13px] text-accent font-semibold">
                      Tous les {artists.length} artiste{artists.length > 1 ? 's' : ''} seront inclus
                    </p>
                  </div>
                ) : (
                  <div className="border border-line rounded-[10px] max-h-48 overflow-y-auto">
                    {artists.map((artist) => (
                      <label
                        key={artist.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 cursor-pointer border-b border-line last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedArtistIds.includes(artist.id)}
                          onChange={() => toggleArtistSelection(artist.id)}
                          className="w-4 h-4 rounded accent-[var(--accent)]"
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
                          <Avatar name={artist.name} size={28} />
                        )}
                        <span className="text-[13px] text-ink">{artist.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-line flex gap-3">
              <OutlineButton onClick={() => setShowCreate(false)} className="flex-1 justify-center">
                Annuler
              </OutlineButton>
              <AccentButton
                onClick={handleCreate}
                disabled={creating || !periodStart || !periodEnd || (!selectAllArtists && selectedArtistIds.length === 0)}
                className="flex-1"
              >
                {creating ? <Spinner size="sm" /> : null} Calculer
              </AccentButton>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRun && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-surface w-full sm:max-w-lg sm:rounded-[16px] rounded-t-[16px] max-h-[90vh] overflow-y-auto shadow-roy">
            <div className="px-5 py-4 border-b border-line">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[16px] font-bold text-ink">
                    {formatPeriod(selectedRun.period_start, selectedRun.period_end)}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    {selectedRun.is_locked
                      ? <Pill tone="neutral">Verrouillé</Pill>
                      : <Pill tone="neutral">{ROYALTY_STATUS_LABELS[selectedRun.status]}</Pill>}
                  </div>
                </div>
                <button onClick={() => setSelectedRun(null)} className="p-2 -mr-2 text-ink-faint hover:text-ink">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-2 rounded-[12px] p-4">
                  <Eyebrow>Revenus bruts</Eyebrow>
                  <p className="roy-num text-[20px] font-bold text-ink mt-1.5">{formatCurrency(selectedRun.total_gross, selectedRun.base_currency)}</p>
                </div>
                <div className="bg-accent-soft rounded-[12px] p-4">
                  <Eyebrow>Net à payer</Eyebrow>
                  <p className="roy-num text-[20px] font-bold text-accent mt-1.5">{formatCurrency(selectedRun.total_net_payable, selectedRun.base_currency)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface-2 rounded-[10px] p-3 text-center">
                  <p className="roy-num text-[15px] font-bold text-ink">{formatCurrency(selectedRun.total_artist_royalties, selectedRun.base_currency)}</p>
                  <p className="text-[11px] text-ink-faint mt-0.5">Part artistes</p>
                </div>
                <div className="bg-surface-2 rounded-[10px] p-3 text-center">
                  <p className="roy-num text-[15px] font-bold text-ink">{formatCurrency(selectedRun.total_label_royalties, selectedRun.base_currency)}</p>
                  <p className="text-[11px] text-ink-faint mt-0.5">Part label</p>
                </div>
                <div className="bg-surface-2 rounded-[10px] p-3 text-center">
                  <p className="roy-num text-[15px] font-bold text-ink">{formatCurrency(selectedRun.total_recouped, selectedRun.base_currency)}</p>
                  <p className="text-[11px] text-ink-faint mt-0.5">Avances déduites</p>
                </div>
              </div>

              {/* Plain-language récap of how the calcul flows: ventes → parts → avances → à payer */}
              <div className="bg-surface-2/60 border border-line rounded-[12px] p-4">
                <p className="text-[12.5px] leading-relaxed text-ink-muted">
                  Sur <strong className="text-ink">{formatCurrency(selectedRun.total_gross, selectedRun.base_currency)}</strong> de ventes,
                  la part des artistes est de <strong className="text-ink">{formatCurrency(selectedRun.total_artist_royalties, selectedRun.base_currency)}</strong>.
                  Après déduction de <strong className="text-ink">{formatCurrency(selectedRun.total_recouped, selectedRun.base_currency)}</strong> d&apos;avances,
                  il reste <strong className="text-accent">{formatCurrency(selectedRun.total_net_payable, selectedRun.base_currency)}</strong> à payer.
                </p>
              </div>

              <div className="bg-surface-2 rounded-[12px] p-4 text-center">
                <p className="roy-num text-[26px] font-bold text-ink">{formatNumber(selectedRun.total_transactions)}</p>
                <p className="text-[12px] text-ink-faint">transactions traitées</p>
              </div>

              {/* Artists breakdown */}
              {selectedRun.artists && selectedRun.artists.length > 0 && (
                <div>
                  <span className="text-[13.5px] font-semibold text-ink">Détail par artiste</span>
                  <div className="space-y-2 mt-3">
                    {selectedRun.artists.map((artist) => {
                      const isPaid = artist.statement_status === 'paid';
                      return (
                        <div key={artist.artist_id} className="rounded-[12px] p-4 bg-surface-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar name={artist.artist_name || '?'} size={34} accent={isPaid} />
                              <div className="min-w-0">
                                <p className="text-[13.5px] font-semibold text-ink truncate">{artist.artist_name || 'Inconnu'}</p>
                                <p className="text-[11.5px] text-ink-faint">
                                  {formatNumber(artist.transaction_count)} transactions
                                  {isPaid && artist.paid_at && (
                                    <> · Payé le {new Date(artist.paid_at).toLocaleDateString('fr-FR')}</>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="roy-num text-[14px] font-bold text-ink">
                                {formatCurrency(artist.net_payable, selectedRun.base_currency)}
                              </p>
                              {parseFloat(artist.recouped) > 0 && (
                                <p className="text-[11px] text-ink-faint">-{formatCurrency(artist.recouped, selectedRun.base_currency)} d&apos;avances déduites</p>
                              )}
                              {isPaid && (
                                <span className="inline-flex mt-1"><Pill tone="accent"><IconCheck size={11} /> Payé</Pill></span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedRun.artists && selectedRun.artists.length === 0 && (
                <div className="bg-surface-2 rounded-[12px] p-4 text-center">
                  <p className="text-[13px] text-ink-faint">Aucun artiste pour cette période</p>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-line space-y-3">
              {/* Actions */}
              <div className="flex gap-3">
                <OutlineButton onClick={() => setSelectedRun(null)} className="flex-1 justify-center">
                  Fermer
                </OutlineButton>
                {selectedRun.status === 'completed' && !selectedRun.is_locked && (
                  <AccentButton
                    onClick={() => handleLock(selectedRun.run_id)}
                    disabled={locking}
                    className="flex-1"
                  >
                    {locking ? <Spinner size="sm" /> : <IconCheck size={14} />} Verrouiller
                  </AccentButton>
                )}
              </div>

              {/* Pay all button — only visible on locked runs with unpaid artists */}
              {selectedRun.is_locked && selectedRun.artists?.some(a => a.statement_status !== 'paid' && parseFloat(a.net_payable) > 0) && (
                <AccentButton
                  onClick={() => handlePayAll(selectedRun)}
                  disabled={payingAll}
                  className="w-full"
                >
                  {payingAll ? <Spinner size="sm" /> : <IconCheck size={14} />} Marquer tout comme payé
                </AccentButton>
              )}

              {/* All paid confirmation */}
              {selectedRun.is_locked && selectedRun.artists?.length > 0 && selectedRun.artists.every(a => a.statement_status === 'paid' || parseFloat(a.net_payable) === 0) && (
                <div className="flex items-center justify-center gap-2 py-3 bg-accent-soft rounded-[12px]">
                  <IconCheck size={16} className="text-accent" />
                  <span className="text-[13px] font-semibold text-accent">Tous les artistes ont été payés</span>
                </div>
              )}

              {/* Delete button - always visible */}
              <button
                onClick={() => handleDelete(selectedRun)}
                disabled={deleting}
                className="w-full py-2.5 text-[12.5px] font-semibold rounded-[10px] text-neg hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Suppression...' : selectedRun.is_locked ? 'Supprimer (verrouillé)' : 'Supprimer ce calcul'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal — replaces native confirm() for paiement / suppression */}
      {confirmAction && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[60]"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="bg-surface w-full sm:max-w-sm sm:rounded-[16px] rounded-t-[16px] shadow-roy"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <h2 className="text-[16px] font-bold text-ink">{confirmAction.title}</h2>
              <p className="text-[13px] leading-relaxed text-ink-muted mt-2">{confirmAction.message}</p>
            </div>
            <div className="p-5 pt-0 flex gap-3">
              <OutlineButton onClick={() => setConfirmAction(null)} className="flex-1 justify-center">
                Annuler
              </OutlineButton>
              {confirmAction.danger ? (
                <button
                  onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[10px] text-[13px] font-semibold bg-neg text-white hover:opacity-90 transition-opacity"
                >
                  {confirmAction.confirmLabel}
                </button>
              ) : (
                <AccentButton
                  onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
                  className="flex-1"
                >
                  <IconCheck size={14} /> {confirmAction.confirmLabel}
                </AccentButton>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
