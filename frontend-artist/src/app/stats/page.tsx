'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getPlatformStats, getQuarterlyRevenue, PlatformStats, QuarterlyRevenue } from '@/lib/api';
import BottomNav from '@/components/layout/BottomNav';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const PLATFORM_COLORS: Record<string, string> = {
  spotify: '#1DB954',
  apple_music: '#FC3C44',
  deezer: '#A238FF',
  tiktok: '#00F2EA',
  amazon: '#FF9900',
  amazon_music: '#FF9900',
  youtube: '#FF0000',
  youtube_music: '#FF0000',
  bandcamp: '#1DA0C3',
  soundcloud: '#FF5500',
  tidal: '#000000',
  other: '#6366f1',
};

export default function StatsPage() {
  const { artist, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<PlatformStats[]>([]);
  const [quarterly, setQuarterly] = useState<QuarterlyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (artist) {
      loadStats();
    }
  }, [artist, year]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [platformData, quarterlyData] = await Promise.all([
        getPlatformStats(year),
        getQuarterlyRevenue(year),
      ]);
      setStats(platformData);
      setQuarterly(quarterlyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string | number, currency: string = 'EUR') => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString('fr-FR', { style: 'currency', currency });
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toLocaleString('fr-FR');
  };

  const totalRevenue = stats.reduce((sum, s) => sum + parseFloat(s.gross), 0);
  const totalStreams = stats.reduce((sum, s) => sum + s.streams, 0);

  // Chart data
  const barChartData = [...stats]
    .sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross))
    .map((s) => ({
      name: s.platform_label,
      revenue: parseFloat(s.gross),
      streams: s.streams,
      platform: s.platform,
      percentage: s.percentage,
    }));

  const lineChartData = quarterly.map((q) => ({
    name: `${q.quarter} ${q.year}`,
    gross: parseFloat(q.gross),
    net: parseFloat(q.net),
    streams: q.streams,
  }));

  const pieChartData = stats.map((s) => ({
    name: s.platform_label,
    value: parseFloat(s.gross),
    platform: s.platform,
    percentage: s.percentage,
    streams: s.streams,
  }));

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-zinc-800 transition-colors">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="font-semibold text-white">Statistiques</h1>
              <p className="text-xs text-zinc-500">Par plateforme</p>
            </div>
          </div>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-medium text-white focus:outline-none focus:border-indigo-500 transition-colors"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </header>

      <main className="px-4 py-4 pb-24 space-y-6 max-w-4xl mx-auto">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" color="primary" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Revenus {year}</p>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Streams {year}</p>
                <p className="text-2xl font-bold text-white">{formatNumber(totalStreams)}</p>
              </div>
            </div>

            {/* ===== REVENUE BY PLATFORM - Horizontal Bar Chart ===== */}
            {barChartData.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                  Revenus par plateforme
                </h2>
                <div style={{ height: Math.max(barChartData.length * 50, 200) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={barChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatCurrency(v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: '#d4d4d8', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={100}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff' }}
                        labelStyle={{ color: '#a1a1aa' }}
                        formatter={(value: number) => [formatCurrency(value), 'Revenu']}
                      />
                      <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={24}>
                        {barChartData.map((entry) => (
                          <Cell
                            key={entry.platform}
                            fill={PLATFORM_COLORS[entry.platform] || PLATFORM_COLORS.other}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ===== REVENUE TREND - Line Chart ===== */}
            {lineChartData.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                  Tendance des revenus
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineChartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff' }}
                        labelStyle={{ color: '#a1a1aa' }}
                        formatter={(value: number, name: string) => [
                          formatCurrency(value),
                          name === 'gross' ? 'Brut' : 'Net',
                        ]}
                      />
                      <Line type="monotone" dataKey="gross" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981', stroke: '#18181b', strokeWidth: 2 }} />
                      <Line type="monotone" dataKey="net" stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: '#6366f1', stroke: '#18181b', strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-3 justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-xs text-zinc-500">Brut</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-500" />
                    <span className="text-xs text-zinc-500">Net</span>
                  </div>
                </div>
              </div>
            )}

            {/* ===== PLATFORM DISTRIBUTION - Pie Chart ===== */}
            {pieChartData.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                  Distribution des revenus
                </h2>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-64 h-64 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          innerRadius={50}
                          dataKey="value"
                          stroke="none"
                          label={({ percentage }) => `${percentage.toFixed(1)}%`}
                          labelLine={false}
                        >
                          {pieChartData.map((entry) => (
                            <Cell
                              key={entry.platform}
                              fill={PLATFORM_COLORS[entry.platform] || PLATFORM_COLORS.other}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff' }}
                          formatter={(value: number) => [formatCurrency(value), 'Revenu']}
                        />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          iconSize={10}
                          formatter={(value: string) => (
                            <span className="text-xs text-zinc-400">{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    {pieChartData.map((p) => (
                      <div key={p.platform} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/30">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: PLATFORM_COLORS[p.platform] || PLATFORM_COLORS.other }}
                        />
                        <span className="text-sm text-zinc-300 flex-1">{p.name}</span>
                        <span className="text-sm text-emerald-400 font-medium">{formatCurrency(p.value)}</span>
                        <span className="text-xs text-zinc-600 w-12 text-right">{p.percentage.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== PLATFORM DETAIL TABLE ===== */}
            {stats.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-800">
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                    Detail par plateforme
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Plateforme</th>
                        <th className="text-right px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Revenus</th>
                        <th className="text-right px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Streams</th>
                        <th className="text-right px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Part</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...stats]
                        .sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross))
                        .map((platform) => (
                          <tr key={platform.platform} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: PLATFORM_COLORS[platform.platform] || PLATFORM_COLORS.other }}
                                />
                                <span className="text-white font-medium">{platform.platform_label}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right text-emerald-400 font-medium">
                              {formatCurrency(platform.gross)}
                            </td>
                            <td className="px-5 py-3 text-right text-zinc-300">
                              {formatNumber(platform.streams)}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300">
                                {platform.percentage.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-zinc-800/50">
                        <td className="px-5 py-3 text-white font-semibold">Total</td>
                        <td className="px-5 py-3 text-right text-emerald-400 font-bold">
                          {formatCurrency(totalRevenue)}
                        </td>
                        <td className="px-5 py-3 text-right text-white font-semibold">
                          {formatNumber(totalStreams)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-700 text-white">
                            100%
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {stats.length === 0 && (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-zinc-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-zinc-500 text-lg">Aucune donnee pour {year}</p>
                <p className="text-zinc-600 text-sm mt-1">Essayez de selectionner une autre annee</p>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
