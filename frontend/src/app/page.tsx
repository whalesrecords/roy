'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Area, Line,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import {
  getArtists, getImports, getRoyaltyRuns, getTicketStats,
  getAnalyticsSummary, AnalyticsSummary, getArtistsSummary, ArtistSummary,
  getSpotifySuggestions,
} from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { Card, Eyebrow, Kpi, Pill, Avatar, AccentButton } from '@/components/roy/ui';
import { IconImport, IconRoyalty, IconTicket, IconChevronRight, IconSparkles, IconPlus } from '@/components/roy/icons';

const COLORS = ['#15CE8E', '#4D8DFF', '#E3B341', '#FC3C44', '#8b5cf6', '#00C7F2', '#f97316', '#ec4899'];

type DashboardView = 'overview' | 'revenue' | 'expenses' | 'artists';
const VIEW_LABELS: Record<DashboardView, string> = {
  overview: "Vue d'ensemble", revenue: 'Revenus', expenses: 'Dépenses', artists: 'Artistes',
};
const DASHBOARD_VIEWS = Object.keys(VIEW_LABELS) as DashboardView[];

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [view, setView] = useState<DashboardView>('overview');
  const [selectedYear, setSelectedYear] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState('');
  const progressRef = useRef(0);

  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [artistsSummary, setArtistsSummary] = useState<ArtistSummary[]>([]);
  const [basicStats, setBasicStats] = useState({ artists: 0, imports: 0, pendingRuns: 0, openTickets: 0 });
  const [recentImports, setRecentImports] = useState<{ id: string; source: string; period_start: string; period_end: string; total_rows: number }[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [pendingSpotify, setPendingSpotify] = useState(0);

  const STEPS = [
    { label: 'Artistes', weight: 15 }, { label: 'Imports', weight: 20 }, { label: 'Calculs', weight: 15 },
    { label: 'Tickets', weight: 10 }, { label: 'Résumés', weight: 15 }, { label: 'Analytics', weight: 25 },
  ];
  const tick = useCallback((i: number) => {
    progressRef.current = Math.min(100, progressRef.current + STEPS[i].weight);
    setProgress(progressRef.current); setLoadingStep(STEPS[i].label);
  }, []);

  const loadAll = useCallback(async (yearOverride?: number) => {
    setLoading(true); progressRef.current = 0; setProgress(0); setLoadingStep('Démarrage…');
    try {
      const [artists, imports, runs, tickets, artSummary, spotifySuggestions] = await Promise.all([
        getArtists().then((r) => { tick(0); return r; }),
        getImports().then((r) => { tick(1); return r; }),
        getRoyaltyRuns().then((r) => { tick(2); return r; }),
        getTicketStats().catch(() => ({ open: 0 })).then((r) => { tick(3); return r; }),
        getArtistsSummary().catch(() => []).then((r) => { tick(4); return r; }),
        getSpotifySuggestions('pending').catch(() => []),
      ]);
      setPendingSpotify(spotifySuggestions.length);
      const yearSet = new Set<number>();
      imports.forEach((imp) => {
        yearSet.add(new Date(imp.period_start).getFullYear());
        const endY = new Date(imp.period_end || imp.period_start).getFullYear();
        yearSet.add(endY);
      });
      const importYears = Array.from(yearSet).sort((a, b) => b - a);
      setAvailableYears(importYears);
      const effectiveYear = yearOverride ?? (selectedYear > 0 ? selectedYear : importYears[0] ?? 0);
      if (effectiveYear !== selectedYear) setSelectedYear(effectiveYear);
      const summary = effectiveYear > 0 ? await getAnalyticsSummary(effectiveYear).catch(() => null) : null;
      tick(5);
      setBasicStats({
        artists: artists.filter((a) => a.category === 'signed').length,
        imports: imports.length,
        pendingRuns: runs.filter((r) => r.status === 'draft' || r.status === 'completed').length,
        openTickets: (tickets as { open?: number }).open || 0,
      });
      setRecentImports(imports.slice(0, 5));
      setAnalytics(summary);
      setArtistsSummary(artSummary);
    } catch (e) {
      console.error('Dashboard load failed:', e);
    } finally {
      setProgress(100);
      await new Promise((r) => setTimeout(r, 300));
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => { if (user) loadAll(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthlyChartData = useMemo(() => {
    if (!analytics) return [];
    return analytics.monthly_revenue.map((rev, i) => ({
      month: rev.month_label,
      revenue: parseFloat(rev.gross),
      expenses: analytics.monthly_expenses[i] ? parseFloat(analytics.monthly_expenses[i].amount) : 0,
    }));
  }, [analytics]);

  const revenueBySource = useMemo(() => {
    if (!analytics) return [];
    return analytics.revenue_by_source.map((s) => ({ name: s.source_label, value: parseFloat(s.gross), count: s.transaction_count }))
      .filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  }, [analytics]);

  const expensesByCategory = useMemo(() => {
    if (!analytics) return [];
    return analytics.expenses_by_category.map((c) => ({ name: c.category_label, value: parseFloat(c.amount), count: c.count }))
      .filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
  }, [analytics]);

  const topArtists = useMemo(
    () => [...artistsSummary].sort((a, b) => parseFloat(String(b.total_gross)) - parseFloat(String(a.total_gross))).slice(0, 10),
    [artistsSummary],
  );
  const maxArtist = topArtists.length ? parseFloat(String(topArtists[0].total_gross)) : 0;

  if (authLoading) return <div className="flex items-center justify-center py-24"><LoadingCircle progress={0} step="Authentification…" /></div>;
  if (!user) { if (typeof window !== 'undefined') window.location.href = '/login'; return null; }

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div>
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Tableau de bord</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">Whales Records · vue label {selectedYear || ''}</p>
        </div>
        <div className="flex items-center gap-2.5">
          {availableYears.length > 0 && (
            <div className="flex gap-1 rounded-[10px] border border-line bg-surface p-1">
              {availableYears.slice(0, 3).map((y) => (
                <button key={y} onClick={() => loadAll(y)}
                  className={`px-3 py-1.5 rounded-[7px] text-[12px] font-${y === selectedYear ? 'semibold' : 'medium'} ${y === selectedYear ? 'bg-ink text-app' : 'text-ink-muted hover:text-ink'}`}>
                  {y}
                </button>
              ))}
            </div>
          )}
          <Link href="/imports"><AccentButton><IconPlus size={14} /> Importer des revenus</AccentButton></Link>
        </div>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {/* View tabs */}
        <div className="flex gap-1 rounded-[11px] border border-line bg-surface p-1 w-fit">
          {DASHBOARD_VIEWS.map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-lg text-[12.5px] font-${view === v ? 'semibold' : 'medium'} transition-colors ${view === v ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:text-ink'}`}>
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24"><LoadingCircle progress={progress} step={loadingStep} /></div>
        ) : (<>
          {/* ===== OVERVIEW ===== */}
          {view === 'overview' && (
            <div className="space-y-4">
              {pendingSpotify > 0 && (
                <Link href="/spotify-suggestions" className="flex items-center gap-3 bg-accent-soft border border-accent/30 rounded-2xl px-4 py-3 hover:opacity-90 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-accent text-accent-ink flex items-center justify-center shrink-0"><IconSparkles size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ink">{pendingSpotify} nouvelle{pendingSpotify > 1 ? 's' : ''} suggestion{pendingSpotify > 1 ? 's' : ''} Spotify</p>
                    <p className="text-[11.5px] text-ink-faint">Nouvelles pistes trouvées — cliquez pour valider</p>
                  </div>
                  <IconChevronRight size={16} className="text-ink-faint" />
                </Link>
              )}

              {/* KPI */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <Kpi label="Revenus" value={analytics ? formatCurrency(analytics.total_revenue) : '—'} hint={analytics ? `+${''}${''}` : undefined} href="/analytics" />
                <Kpi label="Dépenses" value={analytics ? formatCurrency(analytics.total_expenses) : '—'} hint={analytics && parseFloat(analytics.total_revenue) > 0 ? `${Math.round((parseFloat(analytics.total_expenses) / parseFloat(analytics.total_revenue)) * 100)} % des revenus` : undefined} href="/finances" />
                <Kpi label="Royalties dues" value={analytics ? formatCurrency(analytics.total_royalties_payable) : '—'} hint={`${basicStats.artists} artistes`} href="/royalties" />
                <Kpi label="Net label" value={analytics ? formatCurrency(analytics.net) : '—'} hero accentValue hint="après royalties" />
              </div>

              {/* Chart + Top artistes */}
              <div className="grid lg:grid-cols-[1.6fr_1fr] gap-3.5">
                <Card>
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] font-semibold text-ink">Revenus vs Dépenses</span>
                    <div className="flex gap-3">
                      <span className="flex items-center gap-1.5 text-[11px] text-ink-muted"><span className="w-1.5 h-1.5 rounded-full bg-accent" />Revenus</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-ink-muted"><span className="w-1.5 h-1.5 rounded-full bg-ink-faint" />Dépenses</span>
                    </div>
                  </div>
                  {monthlyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={230}>
                      <ComposedChart data={monthlyChartData} margin={{ top: 12, right: 4, left: -8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }} formatter={(value) => formatCurrency(value as number)} />
                        <Area type="monotone" dataKey="revenue" stroke="var(--accent)" fill="url(#gRev)" strokeWidth={2} name="Revenus" dot={false} />
                        <Line type="monotone" dataKey="expenses" stroke="var(--text-3)" strokeWidth={1.5} strokeDasharray="3 3" name="Dépenses" dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : <div className="py-16 text-center text-ink-faint text-sm">Aucune donnée pour {selectedYear}</div>}
                </Card>

                <Card>
                  <span className="text-[13.5px] font-semibold text-ink">Top artistes</span>
                  <div className="flex flex-col gap-3 mt-3.5">
                    {topArtists.slice(0, 5).map((a, i) => (
                      <Link key={a.id} href={`/artists/${a.id}`} className="flex items-center gap-2.5 group">
                        <span className="font-mono text-[11px] text-ink-faint w-3">{i + 1}</span>
                        <Avatar name={a.name} src={a.image_url} size={30} accent={i === 0} />
                        <span className="flex-1 text-[13px] font-semibold text-ink truncate group-hover:text-accent transition-colors">{a.name}</span>
                        <span className="roy-num text-[12.5px] font-bold text-ink">{formatCurrency(parseFloat(String(a.total_gross)))}</span>
                      </Link>
                    ))}
                    {topArtists.length === 0 && <p className="text-ink-faint text-sm py-4">Aucun artiste</p>}
                  </div>
                </Card>
              </div>

              {/* Imports + à traiter */}
              <div className="grid lg:grid-cols-2 gap-3.5">
                <Card>
                  <span className="text-[13.5px] font-semibold text-ink">Imports récents</span>
                  <div className="flex flex-col mt-2">
                    {recentImports.length === 0 ? <p className="text-ink-faint text-sm py-3">Aucun import</p> :
                      recentImports.map((imp, i) => (
                        <div key={imp.id} className={`flex items-center justify-between py-2.5 ${i < recentImports.length - 1 ? 'border-b border-line' : ''}`}>
                          <div>
                            <div className="text-[13px] font-semibold text-ink capitalize">{imp.source} · {new Date(imp.period_start).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</div>
                            <div className="text-[11px] text-ink-faint mt-0.5">{formatNumber(imp.total_rows)} lignes</div>
                          </div>
                          <Pill tone="accent">Traité</Pill>
                        </div>
                      ))}
                  </div>
                </Card>
                <Card>
                  <span className="text-[13.5px] font-semibold text-ink">À traiter</span>
                  <div className="flex flex-col gap-2.5 mt-3.5">
                    <Link href="/royalties" className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 hover:bg-surface-2/70 transition-colors">
                      <div className="w-[34px] h-[34px] rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0"><IconRoyalty size={16} /></div>
                      <div className="flex-1"><div className="text-[13px] font-semibold text-ink">{basicStats.pendingRuns} calcul{basicStats.pendingRuns > 1 ? 's' : ''} de royalties</div><div className="text-[11px] text-ink-faint">en attente de validation</div></div>
                      <IconChevronRight size={16} className="text-ink-faint" />
                    </Link>
                    <Link href="/tickets" className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 hover:bg-surface-2/70 transition-colors">
                      <div className="w-[34px] h-[34px] rounded-[10px] bg-surface border border-line text-ink-muted flex items-center justify-center shrink-0"><IconTicket size={16} /></div>
                      <div className="flex-1"><div className="text-[13px] font-semibold text-ink">{basicStats.openTickets} ticket{basicStats.openTickets > 1 ? 's' : ''} ouvert{basicStats.openTickets > 1 ? 's' : ''}</div><div className="text-[11px] text-ink-faint">demandes artistes</div></div>
                      <IconChevronRight size={16} className="text-ink-faint" />
                    </Link>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ===== REVENUE ===== */}
          {view === 'revenue' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                <Kpi label="Revenus totaux" value={analytics ? formatCurrency(analytics.total_revenue) : '—'} accentValue />
                <Kpi label="Sources" value={revenueBySource.length.toString()} />
                <Kpi label="Transactions" value={analytics ? formatNumber(analytics.revenue_by_source.reduce((s, r) => s + r.transaction_count, 0)) : '—'} />
              </div>
              {monthlyChartData.length > 0 && (
                <Card>
                  <span className="text-[13.5px] font-semibold text-ink">Revenus mensuels</span>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyChartData} margin={{ top: 12, right: 4, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }} formatter={(value) => formatCurrency(value as number)} />
                      <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Revenus" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
              {revenueBySource.length > 0 && (
                <div className="grid md:grid-cols-2 gap-3.5">
                  <Card>
                    <span className="text-[13.5px] font-semibold text-ink">Par source</span>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={revenueBySource} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                          {revenueBySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }} formatter={(value) => formatCurrency(value as number)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                  <Card>
                    <span className="text-[13.5px] font-semibold text-ink">Détail par source</span>
                    <div className="space-y-3 mt-3.5">
                      {revenueBySource.map((s, i) => (
                        <div key={s.name} className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-[13px] text-ink"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: COLORS[i % COLORS.length] }} />{s.name}</span>
                          <span className="roy-num text-[13px] font-semibold text-ink">{formatCurrency(s.value)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* ===== EXPENSES ===== */}
          {view === 'expenses' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                <Kpi label="Dépenses totales" value={analytics ? formatCurrency(analytics.total_expenses) : '—'} />
                <Kpi label="Royalties dues" value={analytics ? formatCurrency(analytics.total_royalties_payable) : '—'} />
                <Kpi label="Sortie totale" value={analytics ? formatCurrency(analytics.total_outflow) : '—'} />
              </div>
              {expensesByCategory.length > 0 && (
                <Card>
                  <span className="text-[13.5px] font-semibold text-ink">Dépenses par catégorie</span>
                  <div className="flex flex-col gap-3 mt-4">
                    {expensesByCategory.map((c) => {
                      const max = expensesByCategory[0].value || 1;
                      return (
                        <div key={c.name}>
                          <div className="flex justify-between mb-1.5"><span className="text-[12.5px] text-ink">{c.name}</span><span className="roy-num text-[12.5px] font-semibold text-ink">{formatCurrency(c.value)}</span></div>
                          <div className="h-1.5 rounded-full bg-track overflow-hidden"><div className="h-full bg-accent" style={{ width: `${(c.value / max) * 100}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ===== ARTISTS ===== */}
          {view === 'artists' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                <Kpi label="Artistes signés" value={basicStats.artists.toString()} href="/artists" />
                <Kpi label="Avec revenus" value={artistsSummary.filter((a) => parseFloat(String(a.total_gross)) > 0).length.toString()} />
                <Kpi label="Revenus artistes" value={formatCurrency(artistsSummary.reduce((s, a) => s + parseFloat(String(a.total_gross)), 0))} accentValue />
              </div>
              {topArtists.length > 0 && (
                <Card padded={false} className="overflow-hidden">
                  <div className="px-[22px] py-4 border-b border-line text-[13.5px] font-semibold text-ink">Classement artistes</div>
                  <div className="grid grid-cols-[40px_2fr_1fr_1fr] px-[22px] py-3 border-b border-line roy-eyebrow text-[10px]">
                    <span>#</span><span>Artiste</span><span className="text-right">Revenus</span><span className="text-right">Streams</span>
                  </div>
                  {topArtists.map((a, i) => (
                    <Link key={a.id} href={`/artists/${a.id}`} className="grid grid-cols-[40px_2fr_1fr_1fr] items-center px-[22px] py-3 border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                      <span className="font-mono text-[11px] text-ink-faint">{i + 1}</span>
                      <span className="flex items-center gap-2.5 min-w-0"><Avatar name={a.name} src={a.image_url} size={30} accent={i === 0} /><span className="text-[13px] font-semibold text-ink truncate">{a.name}</span></span>
                      <span className="text-right roy-num text-[13px] font-bold text-ink">{formatCurrency(parseFloat(String(a.total_gross)))}</span>
                      <span className="text-right roy-num text-[13px] text-ink-muted">{formatNumber(parseFloat(String(a.total_streams)))}</span>
                    </Link>
                  ))}
                </Card>
              )}
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}

const CIRCUMFERENCE = 2 * Math.PI * 44;
function LoadingCircle({ progress, step }: { progress: number; step: string }) {
  const offset = CIRCUMFERENCE * (1 - progress / 100);
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--track)" strokeWidth="5" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset} className="transition-all duration-500 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="roy-num text-xl font-bold text-ink">{Math.round(progress)}<span className="text-sm font-medium text-ink-faint">%</span></span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-ink">Chargement</p>
        <p className="text-xs text-ink-faint mt-0.5">{step}</p>
      </div>
    </div>
  );
}
