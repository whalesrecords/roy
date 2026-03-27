'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getPlatformStats, getQuarterlyRevenue, getAvailableYears, PlatformStats, QuarterlyRevenue } from '@/lib/api';
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
  Cell,
} from 'recharts';

const PLATFORM_COLORS: Record<string, string> = {
  spotify: '#1DB954',
  apple_music: '#FC3C44',
  amazon: '#FF9900',
  amazon_music: '#FF9900',
  youtube: '#FF0000',
  youtube_music: '#FF0000',
  deezer: '#00C7F2',
  tunecore: '#FF5500',
  bandcamp: '#1DA0C3',
  tiktok: '#00F2EA',
  soundcloud: '#FF5500',
  tidal: '#000000',
  other: '#6b7280',
};

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

type SortKey = 'revenue' | 'streams' | 'percentage';
type SortDir = 'asc' | 'desc';

export default function StatsPage() {
  const { artist, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<PlatformStats[]>([]);
  const [quarterly, setQuarterly] = useState<QuarterlyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(0); // 0 = auto-detect
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
  const [tableSortKey, setTableSortKey] = useState<SortKey>('revenue');
  const [tableSortDir, setTableSortDir] = useState<SortDir>('desc');
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Load available years from dedicated endpoint
  useEffect(() => {
    if (!artist) return;
    const detectYears = async () => {
      try {
        const data = await getAvailableYears();
        const years = data.years.length > 0 ? data.years : [new Date().getFullYear()];
        setAvailableYears(years);
        if (year === 0) {
          setYear(data.default_year || years[0]);
        }
      } catch {
        const currentYear = new Date().getFullYear();
        setAvailableYears([currentYear]);
        if (year === 0) setYear(currentYear);
      }
    };
    detectYears();
  }, [artist]);

  useEffect(() => {
    if (artist && year > 0) {
      loadStats();
    }
  }, [artist, year]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [platformData, quarterlyData] = await Promise.all([
        getPlatformStats(year),
        getQuarterlyRevenue(year),
      ]);
      setStats(platformData);
      // Filter out quarters with zero data
      setQuarterly(quarterlyData.filter(q => parseFloat(q.gross) > 0 || q.streams > 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
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

  // Filtered quarterly data based on selected quarter
  const filteredQuarterly = useMemo(() => {
    if (!selectedQuarter) return quarterly;
    return quarterly.filter((q) => q.quarter === selectedQuarter);
  }, [quarterly, selectedQuarter]);

  // KPI totals
  const totalRevenue = stats.reduce((sum, s) => sum + parseFloat(s.gross), 0);
  const totalStreams = stats.reduce((sum, s) => sum + s.streams, 0);
  const totalDownloads = 0; // API doesn't separate downloads; placeholder
  const totalPhysical = 0; // API doesn't separate physical; placeholder

  // Bar chart data - sorted by revenue descending
  const barChartData = useMemo(
    () =>
      [...stats]
        .sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross))
        .map((s) => ({
          name: s.platform_label,
          revenue: parseFloat(s.gross),
          streams: s.streams,
          platform: s.platform,
          percentage: s.percentage,
        })),
    [stats]
  );

  // Line chart data from quarterly
  const lineChartData = useMemo(
    () =>
      quarterly.map((q) => ({
        name: `${q.quarter} ${q.year}`,
        gross: parseFloat(q.gross),
        net: parseFloat(q.net),
        streams: q.streams,
      })),
    [quarterly]
  );

  // Sorted table data
  const sortedTableData = useMemo(() => {
    const sorted = [...stats].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (tableSortKey) {
        case 'revenue':
          aVal = parseFloat(a.gross);
          bVal = parseFloat(b.gross);
          break;
        case 'streams':
          aVal = a.streams;
          bVal = b.streams;
          break;
        case 'percentage':
          aVal = a.percentage;
          bVal = b.percentage;
          break;
        default:
          return 0;
      }
      return tableSortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [stats, tableSortKey, tableSortDir]);

  const handleTableSort = (key: SortKey) => {
    if (tableSortKey === key) {
      setTableSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setTableSortKey(key);
      setTableSortDir('desc');
    }
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => (
    <span className={`ml-1 inline-block transition-colors ${active ? 'text-foreground' : 'text-default-400'}`}>
      {active && dir === 'asc' ? '\u2191' : '\u2193'}
    </span>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-content2 transition-colors">
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="font-semibold text-foreground">Statistiques</h1>
              <p className="text-xs text-default-500">Par plateforme</p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-24 space-y-6 max-w-4xl mx-auto">
        {/* Year Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                year === y
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-content2 text-default-500 hover:bg-content3'
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Quarter Selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedQuarter(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedQuarter === null
                ? 'bg-content3 text-foreground border border-divider'
                : 'text-default-500 hover:bg-content2'
            }`}
          >
            Toute l&apos;annee
          </button>
          {QUARTERS.map((q) => (
            <button
              key={q}
              onClick={() => setSelectedQuarter(selectedQuarter === q ? null : q)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedQuarter === q
                  ? 'bg-content3 text-foreground border border-divider'
                  : 'text-default-500 hover:bg-content2'
              }`}
            >
              {q}
            </button>
          ))}
        </div>

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
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-content1 border border-divider rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-default-500 uppercase tracking-wider">Revenus</p>
                <p className="text-xl font-bold text-emerald-400 mt-0.5">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="bg-content1 border border-divider rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-default-500 uppercase tracking-wider">Streams</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{formatNumber(totalStreams)}</p>
              </div>
              <div className="bg-content1 border border-divider rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-default-500 uppercase tracking-wider">Downloads</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{formatNumber(totalDownloads)}</p>
              </div>
              <div className="bg-content1 border border-divider rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-default-500 uppercase tracking-wider">Physique</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{formatNumber(totalPhysical)}</p>
              </div>
            </div>

            {/* Horizontal Bar Chart - Revenue by Platform */}
            {barChartData.length > 0 && (
              <div className="bg-content1 border border-divider rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-default-400 uppercase tracking-wider mb-4">
                  Revenus par plateforme
                </h2>
                <div style={{ height: Math.max(barChartData.length * 48, 200) }}>
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
                        contentStyle={{
                          backgroundColor: '#18181b',
                          border: '1px solid #27272a',
                          borderRadius: '12px',
                          color: '#fff',
                        }}
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

            {/* Line Chart - Revenue Trend */}
            {lineChartData.length > 0 && (
              <div className="bg-content1 border border-divider rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-default-400 uppercase tracking-wider mb-4">
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
                        tickFormatter={(v) =>
                          v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#18181b',
                          border: '1px solid #27272a',
                          borderRadius: '12px',
                          color: '#fff',
                        }}
                        labelStyle={{ color: '#a1a1aa' }}
                        formatter={(value: number, name: string) => [
                          formatCurrency(value),
                          name === 'gross' ? 'Brut' : 'Net',
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="gross"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#10b981', stroke: '#18181b', strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="net"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#6366f1', stroke: '#18181b', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-3 justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-xs text-default-500">Brut</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-500" />
                    <span className="text-xs text-default-500">Net</span>
                  </div>
                </div>
              </div>
            )}

            {/* Platform Table - Sortable */}
            {stats.length > 0 && (
              <div className="bg-content1 border border-divider rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-divider">
                  <h2 className="text-sm font-semibold text-default-400 uppercase tracking-wider">
                    Detail par plateforme
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-divider">
                        <th className="text-left px-5 py-3 text-xs text-default-500 font-medium uppercase tracking-wider">
                          Plateforme
                        </th>
                        <th
                          className="text-right px-5 py-3 text-xs text-default-500 font-medium uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
                          onClick={() => handleTableSort('revenue')}
                        >
                          Revenus
                          <SortIcon active={tableSortKey === 'revenue'} dir={tableSortDir} />
                        </th>
                        <th
                          className="text-right px-5 py-3 text-xs text-default-500 font-medium uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
                          onClick={() => handleTableSort('streams')}
                        >
                          Streams
                          <SortIcon active={tableSortKey === 'streams'} dir={tableSortDir} />
                        </th>
                        <th
                          className="text-right px-5 py-3 text-xs text-default-500 font-medium uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
                          onClick={() => handleTableSort('percentage')}
                        >
                          Part
                          <SortIcon active={tableSortKey === 'percentage'} dir={tableSortDir} />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTableData.map((platform) => (
                        <tr
                          key={platform.platform}
                          className="border-b border-divider/50 hover:bg-content2/30 transition-colors"
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor:
                                    PLATFORM_COLORS[platform.platform] || PLATFORM_COLORS.other,
                                }}
                              />
                              <span className="text-foreground font-medium">
                                {platform.platform_label}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right text-emerald-400 font-medium">
                            {formatCurrency(platform.gross)}
                          </td>
                          <td className="px-5 py-3 text-right text-default-300">
                            {formatNumber(platform.streams)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-content2 text-default-300">
                              {platform.percentage.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-content2/50">
                        <td className="px-5 py-3 text-foreground font-semibold">Total</td>
                        <td className="px-5 py-3 text-right text-emerald-400 font-bold">
                          {formatCurrency(totalRevenue)}
                        </td>
                        <td className="px-5 py-3 text-right text-foreground font-semibold">
                          {formatNumber(totalStreams)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-content2 text-white">
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
                <svg
                  className="w-16 h-16 text-default-500 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <p className="text-default-500 text-lg">Aucune donnee pour {year}</p>
                <p className="text-default-500 text-sm mt-1">Essayez de selectionner une autre annee</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
