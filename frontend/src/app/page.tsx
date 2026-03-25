'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Spinner } from '@heroui/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import {
  getArtists, getImports, getRoyaltyRuns, getTicketStats,
  getAnalyticsSummary, AnalyticsSummary, getArtistsSummary, ArtistSummary,
} from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/formatters';

const COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#f97316', '#ec4899'];

type DashboardView = 'overview' | 'revenue' | 'expenses' | 'artists';

const VIEW_LABELS: Record<DashboardView, string> = {
  overview: 'Vue d\'ensemble',
  revenue: 'Revenus',
  expenses: 'Dépenses',
  artists: 'Artistes',
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [view, setView] = useState<DashboardView>('overview');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  // Data
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [artistsSummary, setArtistsSummary] = useState<ArtistSummary[]>([]);
  const [basicStats, setBasicStats] = useState({ artists: 0, imports: 0, pendingRuns: 0, openTickets: 0 });
  const [recentImports, setRecentImports] = useState<{ id: string; source: string; period_start: string; period_end: string; total_rows: number }[]>([]);

  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i), []);

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user, selectedYear]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [artists, imports, runs, tickets, summary, artSummary] = await Promise.all([
        getArtists(),
        getImports(),
        getRoyaltyRuns(),
        getTicketStats().catch(() => ({ open: 0 })),
        getAnalyticsSummary(selectedYear).catch(() => null),
        getArtistsSummary().catch(() => []),
      ]);

      setBasicStats({
        artists: artists.filter(a => a.category === 'signed').length,
        imports: imports.length,
        pendingRuns: runs.filter(r => r.status === 'draft' || r.status === 'completed').length,
        openTickets: (tickets as any).open || 0,
      });
      setRecentImports(imports.slice(0, 5));
      setAnalytics(summary);
      setArtistsSummary(artSummary);
    } catch (e) {
      console.error('Dashboard load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // Derived chart data
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
    return analytics.revenue_by_source.map(s => ({
      name: s.source_label,
      value: parseFloat(s.gross),
      count: s.transaction_count,
    })).filter(s => s.value > 0).sort((a, b) => b.value - a.value);
  }, [analytics]);

  const expensesByCategory = useMemo(() => {
    if (!analytics) return [];
    return analytics.expenses_by_category.map(c => ({
      name: c.category_label,
      value: parseFloat(c.amount),
      count: c.count,
    })).filter(c => c.value > 0).sort((a, b) => b.value - a.value);
  }, [analytics]);

  const topArtists = useMemo(() => {
    return [...artistsSummary]
      .sort((a, b) => parseFloat(String(b.total_gross)) - parseFloat(String(a.total_gross)))
      .slice(0, 10);
  }, [artistsSummary]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" color="primary" /></div>;
  }
  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-sm text-default-500">Whales Records — {selectedYear}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="text-sm bg-background border border-divider rounded-lg px-3 py-1.5 text-foreground"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 bg-default-100 rounded-xl p-1">
        {(Object.keys(VIEW_LABELS) as DashboardView[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg transition-all ${
              view === v
                ? 'bg-background text-foreground shadow-sm'
                : 'text-default-500 hover:text-foreground'
            }`}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" color="primary" /></div>
      ) : (
        <>
          {/* ===== OVERVIEW ===== */}
          {view === 'overview' && (
            <div className="space-y-5">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Revenus" value={analytics ? formatCurrency(analytics.total_revenue) : '—'} color="text-success" href="/analytics" />
                <StatCard label="Dépenses" value={analytics ? formatCurrency(analytics.total_expenses) : '—'} color="text-danger" href="/finances" />
                <StatCard label="Royalties dues" value={analytics ? formatCurrency(analytics.total_royalties_payable) : '—'} color="text-warning" href="/royalties" />
                <StatCard label="Net" value={analytics ? formatCurrency(analytics.net) : '—'} color={analytics && parseFloat(analytics.net) >= 0 ? 'text-success' : 'text-danger'} />
              </div>

              {/* Revenue vs Expenses Chart */}
              {monthlyChartData.length > 0 && (
                <div className="bg-background rounded-2xl p-5 border border-divider">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Revenus vs Dépenses — {selectedYear}</h2>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={monthlyChartData}>
                      <defs>
                        <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#gradRevenue)" strokeWidth={2} name="Revenus" />
                      <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#gradExpenses)" strokeWidth={2} name="Dépenses" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Quick Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Artistes signés" value={basicStats.artists.toString()} href="/artists" />
                <StatCard label="Imports" value={basicStats.imports.toString()} href="/imports" />
                <StatCard label="Calculs en attente" value={basicStats.pendingRuns.toString()} color="text-warning" href="/royalties" />
                <StatCard label="Tickets ouverts" value={basicStats.openTickets.toString()} href="/tickets" />
              </div>

              {/* Quick Actions */}
              <div className="bg-background rounded-2xl p-5 border border-divider">
                <h2 className="text-sm font-semibold text-foreground mb-3">Actions rapides</h2>
                <div className="flex flex-wrap gap-3">
                  <ActionLink href="/imports" label="Importer des revenus" primary />
                  <ActionLink href="/contracts" label="Nouveau contrat" />
                  <ActionLink href="/royalties" label="Calculer royalties" />
                </div>
              </div>
            </div>
          )}

          {/* ===== REVENUE VIEW ===== */}
          {view === 'revenue' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard label="Revenus totaux" value={analytics ? formatCurrency(analytics.total_revenue) : '—'} color="text-success" />
                <StatCard label="Sources" value={revenueBySource.length.toString()} />
                <StatCard label="Transactions" value={analytics ? formatNumber(analytics.revenue_by_source.reduce((s, r) => s + r.transaction_count, 0)) : '—'} />
              </div>

              {/* Monthly Revenue Bar Chart */}
              {monthlyChartData.length > 0 && (
                <div className="bg-background rounded-2xl p-5 border border-divider">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Revenus mensuels</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenus" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Revenue by Source Pie + List */}
              {revenueBySource.length > 0 && (
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="bg-background rounded-2xl p-5 border border-divider">
                    <h2 className="text-sm font-semibold text-foreground mb-4">Par source</h2>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={revenueBySource} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                          {revenueBySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-background rounded-2xl p-5 border border-divider">
                    <h2 className="text-sm font-semibold text-foreground mb-4">Détail par source</h2>
                    <div className="space-y-3">
                      {revenueBySource.map((s, i) => (
                        <div key={s.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-sm text-foreground">{s.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-foreground">{formatCurrency(s.value)}</span>
                            <span className="text-xs text-default-400 ml-2">{formatNumber(s.count)} tx</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== EXPENSES VIEW ===== */}
          {view === 'expenses' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard label="Dépenses totales" value={analytics ? formatCurrency(analytics.total_expenses) : '—'} color="text-danger" />
                <StatCard label="Royalties dues" value={analytics ? formatCurrency(analytics.total_royalties_payable) : '—'} color="text-warning" />
                <StatCard label="Sortie totale" value={analytics ? formatCurrency(analytics.total_outflow) : '—'} color="text-danger" />
              </div>

              {/* Monthly Expenses */}
              {monthlyChartData.length > 0 && (
                <div className="bg-background rounded-2xl p-5 border border-divider">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Dépenses mensuelles</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Dépenses" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Expenses by Category */}
              {expensesByCategory.length > 0 && (
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="bg-background rounded-2xl p-5 border border-divider">
                    <h2 className="text-sm font-semibold text-foreground mb-4">Par catégorie</h2>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={expensesByCategory} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                          {expensesByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-background rounded-2xl p-5 border border-divider">
                    <h2 className="text-sm font-semibold text-foreground mb-4">Détail par catégorie</h2>
                    <div className="space-y-3">
                      {expensesByCategory.map((c, i) => (
                        <div key={c.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-sm text-foreground">{c.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-danger">{formatCurrency(c.value)}</span>
                            <span className="text-xs text-default-400 ml-2">{c.count} ops</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== ARTISTS VIEW ===== */}
          {view === 'artists' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard label="Artistes signés" value={basicStats.artists.toString()} href="/artists" />
                <StatCard label="Avec revenus" value={artistsSummary.filter(a => parseFloat(String(a.total_gross)) > 0).length.toString()} />
                <StatCard label="Revenus artistes" value={formatCurrency(artistsSummary.reduce((s, a) => s + parseFloat(String(a.total_gross)), 0))} color="text-success" />
              </div>

              {/* Top 10 Artists Bar Chart */}
              {topArtists.length > 0 && (
                <div className="bg-background rounded-2xl p-5 border border-divider">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Top 10 artistes — Revenus bruts</h2>
                  <ResponsiveContainer width="100%" height={Math.max(300, topArtists.length * 40)}>
                    <BarChart data={topArtists} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Bar dataKey="total_gross" fill="#6366f1" radius={[0, 4, 4, 0]} name="Revenus bruts" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Artists Table */}
              {topArtists.length > 0 && (
                <div className="bg-background rounded-2xl p-5 border border-divider overflow-x-auto">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Classement artistes</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-divider text-left">
                        <th className="pb-2 text-default-500 font-medium">#</th>
                        <th className="pb-2 text-default-500 font-medium">Artiste</th>
                        <th className="pb-2 text-default-500 font-medium text-right">Revenus bruts</th>
                        <th className="pb-2 text-default-500 font-medium text-right">Streams</th>
                        <th className="pb-2 text-default-500 font-medium text-right">Transactions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topArtists.map((a, i) => (
                        <tr key={a.id} className="border-b border-divider/50 last:border-0">
                          <td className="py-2.5 text-default-400">{i + 1}</td>
                          <td className="py-2.5">
                            <Link href={`/artists/${a.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                              {a.image_url ? (
                                <Image src={a.image_url} alt={a.name} width={28} height={28} className="rounded-full object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-default-200 flex items-center justify-center text-xs font-bold text-default-500">
                                  {a.name.charAt(0)}
                                </div>
                              )}
                              <span className="font-medium text-foreground">{a.name}</span>
                            </Link>
                          </td>
                          <td className="py-2.5 text-right font-semibold text-success">{formatCurrency(parseFloat(String(a.total_gross)))}</td>
                          <td className="py-2.5 text-right text-default-500">{formatNumber(parseFloat(String(a.total_streams)))}</td>
                          <td className="py-2.5 text-right text-default-500">{formatNumber(a.transaction_count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Helper Components ---

function StatCard({ label, value, color, href }: { label: string; value: string; color?: string; href?: string }) {
  const content = (
    <div className={`bg-background rounded-2xl p-4 border border-divider ${href ? 'hover:border-primary/30 transition-colors' : ''}`}>
      <p className="text-[10px] font-semibold text-default-400 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color || 'text-foreground'}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function ActionLink({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        primary
          ? 'bg-primary text-white hover:bg-primary-600'
          : 'bg-default-100 text-foreground hover:bg-default-200'
      }`}
    >
      {label}
    </Link>
  );
}
