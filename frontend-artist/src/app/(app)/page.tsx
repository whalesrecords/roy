'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/layout/NotificationBell';
import { useTheme } from '@/contexts/ThemeContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import {
  getArtistDashboard,
  getArtistReleases,
  getQuarterlyRevenue,
  getPlatformStats,
  getLabelSettings,
  getStatements,
  getMyTickets,
  requestPayment,
  ArtistDashboard,
  ArtistRelease,
  QuarterlyRevenue,
  PlatformStats,
  LabelSettings,
  Statement,
} from '@/lib/api';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
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

export default function DashboardPage() {
  const { artist, loading: authLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [data, setData] = useState<ArtistDashboard | null>(null);
  const [releases, setReleases] = useState<ArtistRelease[]>([]);
  const [quarterly, setQuarterly] = useState<QuarterlyRevenue[]>([]);
  const [platforms, setPlatforms] = useState<PlatformStats[]>([]);
  const [labelSettings, setLabelSettings] = useState<LabelSettings | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestingPayment, setRequestingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [unreadTickets, setUnreadTickets] = useState(0);

  useEffect(() => {
    if (artist) {
      loadDashboard();
      loadUnreadTickets();
      const interval = setInterval(loadUnreadTickets, 30000);
      return () => clearInterval(interval);
    }
  }, [artist]);

  const loadDashboard = async () => {
    try {
      const [dashboard, quarterlyData, releasesData, platformData, settings, statementsData] =
        await Promise.all([
          getArtistDashboard(),
          getQuarterlyRevenue(),
          getArtistReleases(),
          getPlatformStats(),
          getLabelSettings(),
          getStatements(),
        ]);
      setData(dashboard);
      setQuarterly(quarterlyData);
      setReleases(releasesData);
      setPlatforms(platformData);
      setLabelSettings(settings);
      setStatements(statementsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadTickets = async () => {
    try {
      const tickets = await getMyTickets();
      const unreadCount = tickets.filter((t) => t.unread_count > 0).length;
      setUnreadTickets(unreadCount);
    } catch {
      // Silently fail for unread count
    }
  };

  const unpaidStatements = statements.filter((s) => s.status !== 'paid');
  const totalUnpaid = unpaidStatements.reduce((sum, s) => sum + parseFloat(s.net_payable), 0);

  const handleRequestPayment = async () => {
    if (unpaidStatements.length === 0) return;
    setRequestingPayment(true);
    setError(null);
    try {
      await requestPayment(unpaidStatements[0].id);
      setPaymentSuccess('Demande de paiement envoyee !');
      setTimeout(() => setPaymentSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error during request');
    } finally {
      setRequestingPayment(false);
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

  // Chart data
  const quarterlyChartData = quarterly.map((q) => ({
    name: `${q.quarter} ${q.year}`,
    gross: parseFloat(q.gross),
    net: parseFloat(q.net),
    streams: q.streams,
  }));

  const topReleases = [...releases]
    .sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross))
    .slice(0, 5);

  const platformChartData = platforms.map((p) => ({
    name: p.platform_label,
    value: parseFloat(p.gross),
    streams: p.streams,
    percentage: p.percentage,
    platform: p.platform,
  }));

  const totalPlatformStreams = platforms.reduce((sum, p) => sum + p.streams, 0);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!artist) return null;

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(labelSettings?.logo_base64 || labelSettings?.logo_url) ? (
              <img
                src={labelSettings.logo_base64 || labelSettings.logo_url}
                alt={labelSettings.label_name || 'Label'}
                className="h-10 w-auto max-w-[120px] object-contain"
              />
            ) : data?.artist.artwork_url ? (
              <img
                src={data.artist.artwork_url}
                alt={artist.name}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-divider"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-foreground font-bold">
                  {artist.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground">{artist.name}</p>
              <p className="text-xs text-default-500">{labelSettings?.label_name || 'Artist Portal'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-content2 hover:bg-content3 transition-colors"
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-full bg-content2 hover:bg-red-500/20 hover:text-red-400 transition-colors"
            >
              <svg className="w-5 h-5 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 pb-24 space-y-6 max-w-4xl mx-auto">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {paymentSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <p className="text-emerald-400 text-sm flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {paymentSuccess}
            </p>
          </div>
        )}

        {/* ===== HERO SECTION ===== */}
        <div className="bg-content1 border border-divider rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-4">
            {data?.artist.artwork_url ? (
              <img
                src={data.artist.artwork_url}
                alt={data.artist.name}
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-divider"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center">
                <span className="text-foreground text-2xl font-bold">
                  {artist.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">{data?.artist.name}</h1>
              <p className="text-default-500 text-sm">{labelSettings?.label_name || 'Artist Portal'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-default-500 text-xs uppercase tracking-wider mb-1">Revenus nets</p>
              <p className="text-3xl font-bold text-emerald-400">
                {data ? formatCurrency(data.total_net, data.currency) : '--'}
              </p>
            </div>
            <div>
              <p className="text-default-500 text-xs uppercase tracking-wider mb-1">Revenus bruts</p>
              <p className="text-2xl font-semibold text-foreground">
                {data ? formatCurrency(data.total_gross, data.currency) : '--'}
              </p>
            </div>
          </div>

          {data && parseFloat(data.advance_balance) > 0 && (
            <div className="bg-content2/50 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-default-500 text-xs">Avance restante</p>
                <p className="text-amber-400 font-semibold">
                  {formatCurrency(data.advance_balance, data.currency)}
                </p>
              </div>
              <svg className="w-5 h-5 text-amber-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}

          {totalUnpaid > 0 && (
            <button
              onClick={handleRequestPayment}
              disabled={requestingPayment}
              className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {requestingPayment ? (
                <>
                  <Spinner size="sm" color="white" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Demander un paiement
                </>
              )}
            </button>
          )}
        </div>

        {/* ===== REVENUE TREND (Area Chart) ===== */}
        {quarterlyChartData.length > 0 && (
          <div className="bg-content1 border border-divider rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-default-400 uppercase tracking-wider mb-4">
              Tendance des revenus
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={quarterlyChartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff' }}
                    labelStyle={{ color: '#a1a1aa' }}
                    formatter={(value: number, name: string) => [
                      parseFloat(String(value)).toLocaleString('fr-FR', { style: 'currency', currency: data?.currency || 'EUR' }),
                      name === 'gross' ? 'Brut' : 'Net',
                    ]}
                  />
                  <Area type="monotone" dataKey="gross" stroke="#10b981" fill="url(#colorGross)" strokeWidth={2} />
                  <Area type="monotone" dataKey="net" stroke="#6366f1" fill="url(#colorNet)" strokeWidth={2} />
                </AreaChart>
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

        {/* ===== TOP RELEASES ===== */}
        {topReleases.length > 0 && (
          <div className="bg-content1 border border-divider rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-default-400 uppercase tracking-wider">
                Top Sorties
              </h2>
              <Link href="/releases" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                Tout voir
              </Link>
            </div>
            <div className="space-y-3">
              {topReleases.map((release, idx) => (
                <div
                  key={release.upc}
                  className="flex items-center gap-3 p-3 bg-content2/50 rounded-xl hover:bg-content2 transition-colors"
                >
                  <span className="text-default-500 text-sm font-mono w-5 text-center">{idx + 1}</span>
                  {release.artwork_url ? (
                    <img
                      src={release.artwork_url}
                      alt={release.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-content2 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-default-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium text-sm truncate">{release.title}</p>
                    <p className="text-default-500 text-xs">{formatNumber(release.streams)} streams</p>
                  </div>
                  <p className="text-emerald-400 font-semibold text-sm whitespace-nowrap">
                    {formatCurrency(release.gross, release.currency)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== PLATFORM DISTRIBUTION (Donut) ===== */}
        {platformChartData.length > 0 && (
          <div className="bg-content1 border border-divider rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-default-400 uppercase tracking-wider mb-4">
              Distribution par plateforme
            </h2>
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="relative w-48 h-48 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platformChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      dataKey="value"
                      stroke="none"
                    >
                      {platformChartData.map((entry) => (
                        <Cell
                          key={entry.platform}
                          fill={PLATFORM_COLORS[entry.platform] || PLATFORM_COLORS.other}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff' }}
                      formatter={(value: number) => [
                        parseFloat(String(value)).toLocaleString('fr-FR', { style: 'currency', currency: data?.currency || 'EUR' }),
                        'Revenu',
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground">{formatNumber(totalPlatformStreams)}</p>
                    <p className="text-[10px] text-default-500 uppercase">streams</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 w-full">
                {platformChartData.map((p) => (
                  <div key={p.platform} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PLATFORM_COLORS[p.platform] || PLATFORM_COLORS.other }}
                    />
                    <span className="text-xs text-default-400 truncate">{p.name}</span>
                    <span className="text-xs text-default-500 ml-auto">{p.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== QUICK STATS GRID ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-content1 border border-divider rounded-2xl p-4">
            <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-foreground">{data?.release_count || 0}</p>
            <p className="text-xs text-default-500">Sorties</p>
          </div>

          <div className="bg-content1 border border-divider rounded-2xl p-4">
            <div className="w-9 h-9 bg-purple-500/10 rounded-xl flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-foreground">{data?.track_count || 0}</p>
            <p className="text-xs text-default-500">Titres</p>
          </div>

          <div className="bg-content1 border border-divider rounded-2xl p-4">
            <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatNumber(data?.total_streams || 0)}</p>
            <p className="text-xs text-default-500">Streams</p>
          </div>

          <Link href="/stats" className="bg-content1 border border-divider rounded-2xl p-4 hover:border-indigo-500/50 transition-colors">
            <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-foreground">{platforms.length}</p>
            <p className="text-xs text-default-500">Plateformes</p>
          </Link>
        </div>

        {/* ===== QUICK LINKS ===== */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-default-500 uppercase tracking-wider px-1">
            Navigation
          </h2>

          <Link
            href="/releases"
            className="flex items-center gap-4 p-4 bg-content1 border border-divider rounded-2xl hover:border-indigo-500/50 transition-colors"
          >
            <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Mes Sorties</p>
              <p className="text-sm text-default-500">Revenus par album</p>
            </div>
            <svg className="w-5 h-5 text-default-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/tracks"
            className="flex items-center gap-4 p-4 bg-content1 border border-divider rounded-2xl hover:border-indigo-500/50 transition-colors"
          >
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Mes Titres</p>
              <p className="text-sm text-default-500">Revenus par titre</p>
            </div>
            <svg className="w-5 h-5 text-default-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/payments"
            className="flex items-center gap-4 p-4 bg-content1 border border-divider rounded-2xl hover:border-indigo-500/50 transition-colors"
          >
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Paiements</p>
              <p className="text-sm text-default-500">Historique des paiements</p>
            </div>
            <svg className="w-5 h-5 text-default-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/expenses"
            className="flex items-center gap-4 p-4 bg-content1 border border-divider rounded-2xl hover:border-indigo-500/50 transition-colors"
          >
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Frais du Label</p>
              <p className="text-sm text-default-500">Investissements sur vos projets</p>
            </div>
            <svg className="w-5 h-5 text-default-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/contracts"
            className="flex items-center gap-4 p-4 bg-content1 border border-divider rounded-2xl hover:border-indigo-500/50 transition-colors"
          >
            <div className="w-12 h-12 bg-content2/50 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Mes Contrats</p>
              <p className="text-sm text-default-500">Accords de partage des revenus</p>
            </div>
            <svg className="w-5 h-5 text-default-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/support"
            className="flex items-center gap-4 p-4 bg-content1 border border-divider rounded-2xl hover:border-indigo-500/50 transition-colors relative"
          >
            <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Support</p>
              <p className="text-sm text-default-500">Contacter le label</p>
            </div>
            {unreadTickets > 0 && (
              <span className="absolute top-2 right-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                {unreadTickets}
              </span>
            )}
            <svg className="w-5 h-5 text-default-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Label Logo Footer */}
        <div className="flex justify-center pt-4">
          {(labelSettings?.logo_base64 || labelSettings?.logo_url) ? (
            <img
              src={labelSettings.logo_base64 || labelSettings.logo_url}
              alt={labelSettings.label_name || 'Label'}
              className="h-12 object-contain opacity-30"
            />
          ) : (
            <img
              src="/icon.svg"
              alt="Artist Portal"
              className="h-12 object-contain opacity-30"
            />
          )}
        </div>
      </main>

    </div>
  );
}
