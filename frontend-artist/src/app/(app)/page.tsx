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
  getArtistNotifications,
  requestPayment,
  ArtistDashboard,
  ArtistRelease,
  QuarterlyRevenue,
  PlatformStats,
  LabelSettings,
  Statement,
  ArtistNotification,
} from '@/lib/api';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

const PLATFORM_ICONS: Record<string, string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  deezer: 'Deezer',
  tiktok: 'TikTok',
  amazon: 'Amazon',
  amazon_music: 'Amazon Music',
  youtube: 'YouTube',
  youtube_music: 'YouTube Music',
  bandcamp: 'Bandcamp',
  soundcloud: 'SoundCloud',
  tidal: 'Tidal',
};

export default function DashboardPage() {
  const { artist, loading: authLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Critical data
  const [data, setData] = useState<ArtistDashboard | null>(null);
  const [labelSettings, setLabelSettings] = useState<LabelSettings | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);

  // Secondary data
  const [releases, setReleases] = useState<ArtistRelease[]>([]);
  const [quarterly, setQuarterly] = useState<QuarterlyRevenue[]>([]);
  const [platforms, setPlatforms] = useState<PlatformStats[]>([]);
  const [notifications, setNotifications] = useState<ArtistNotification[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [requestingPayment, setRequestingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [unreadTickets, setUnreadTickets] = useState(0);

  // Stage 1: Critical data
  useEffect(() => {
    if (!artist) return;
    let cancelled = false;

    const loadCritical = async () => {
      try {
        const [dashboard, settings, statementsData] = await Promise.all([
          getArtistDashboard(),
          getLabelSettings(),
          getStatements(),
        ]);
        if (cancelled) return;
        setData(dashboard);
        setLabelSettings(settings);
        setStatements(statementsData);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Loading error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadCritical();
    return () => { cancelled = true; };
  }, [artist]);

  // Stage 2: Secondary data (charts + notifications)
  useEffect(() => {
    if (!data) return;
    let cancelled = false;

    const loadSecondary = async () => {
      try {
        const [releasesData, quarterlyData, platformData, notifData] = await Promise.all([
          getArtistReleases(),
          getQuarterlyRevenue(),
          getPlatformStats(),
          getArtistNotifications({ limit: 5 }),
        ]);
        if (cancelled) return;
        setReleases(releasesData);
        setQuarterly(quarterlyData);
        setPlatforms(platformData);
        setNotifications(notifData);
      } catch {
        // Secondary data failure is non-critical
      } finally {
        if (!cancelled) setChartsLoading(false);
      }
    };

    loadSecondary();
    return () => { cancelled = true; };
  }, [data]);

  // Stage 3: Tickets (independent)
  useEffect(() => {
    if (!artist) return;

    const loadUnreadTickets = async () => {
      try {
        const tickets = await getMyTickets();
        const unreadCount = tickets.filter((t: { unread_count: number }) => t.unread_count > 0).length;
        setUnreadTickets(unreadCount);
      } catch {
        // Silently fail
      }
    };

    loadUnreadTickets();
    const interval = setInterval(loadUnreadTickets, 30000);
    return () => clearInterval(interval);
  }, [artist]);

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

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return "A l'instant";
    if (diffMin < 60) return `Il y a ${diffMin}min`;
    if (diffH < 24) return `Il y a ${diffH}h`;
    if (diffD < 7) return `Il y a ${diffD}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  // Chart data — filter out quarters with zero revenue (e.g. future 2026)
  const quarterlyChartData = quarterly
    .filter((q) => parseFloat(q.gross) > 0 || parseFloat(q.net) > 0 || q.streams > 0)
    .map((q) => ({
      name: `${q.quarter} ${q.year}`,
      gross: parseFloat(q.gross),
      net: parseFloat(q.net),
      streams: q.streams,
    }));

  const topReleases = [...releases]
    .sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross))
    .slice(0, 6);

  const sortedPlatforms = [...platforms].sort(
    (a, b) => parseFloat(b.gross) - parseFloat(a.gross)
  );

  const maxPlatformRevenue = sortedPlatforms.length > 0
    ? parseFloat(sortedPlatforms[0].gross)
    : 0;

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

      <main className="px-4 py-5 pb-24 space-y-5 max-w-4xl mx-auto">
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

        {/* ===== 1. HERO BALANCE CARD ===== */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 p-6">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-5">
              {data?.artist.artwork_url ? (
                <img
                  src={data.artist.artwork_url}
                  alt={data.artist.name}
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/20"
                />
              ) : (
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <span className="text-white text-lg font-bold">
                    {artist.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-white">{data?.artist.name}</h1>
                <p className="text-white/60 text-xs">{labelSettings?.label_name || 'Artist Portal'}</p>
              </div>
            </div>

            <p className="text-white/60 text-xs uppercase tracking-widest mb-1">Solde disponible</p>
            <p className="text-4xl font-extrabold text-white tracking-tight mb-1">
              {data ? formatCurrency(data.total_net, data.currency) : '--'}
            </p>
            <p className="text-white/50 text-sm mb-5">
              Brut : {data ? formatCurrency(data.total_gross, data.currency) : '--'}
            </p>

            {data && parseFloat(data.advance_balance) > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 mb-4 flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-xs">Avance restante</p>
                  <p className="text-amber-300 font-semibold text-sm">
                    {formatCurrency(data.advance_balance, data.currency)}
                  </p>
                </div>
                <svg className="w-5 h-5 text-amber-300/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}

            {totalUnpaid > 0 && (
              <button
                onClick={handleRequestPayment}
                disabled={requestingPayment}
                className="w-full bg-white text-indigo-700 font-bold py-3.5 px-4 rounded-xl transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30"
              >
                {requestingPayment ? (
                  <>
                    <Spinner size="sm" />
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
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-content1 border border-divider rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-foreground">{data?.release_count || 0}</p>
            <p className="text-[11px] text-default-500">Sorties</p>
          </div>
          <div className="bg-content1 border border-divider rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-foreground">{data?.track_count || 0}</p>
            <p className="text-[11px] text-default-500">Titres</p>
          </div>
          <div className="bg-content1 border border-divider rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-foreground">{formatNumber(data?.total_streams || 0)}</p>
            <p className="text-[11px] text-default-500">Streams</p>
          </div>
        </div>

        {/* ===== 2. REVENUE CHART ===== */}
        {chartsLoading ? (
          <div className="bg-content1 border border-divider rounded-2xl p-5 animate-pulse">
            <div className="h-4 w-40 bg-content2 rounded mb-4" />
            <div className="h-52 bg-content2 rounded-xl" />
          </div>
        ) : quarterlyChartData.length > 0 && (
          <div className="bg-content1 border border-divider rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-default-400 uppercase tracking-wider">
                Revenus
              </h2>
              <Link href="/stats" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                Voir plus
              </Link>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={quarterlyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashGross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dashNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--divider, #27272a)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--content1, #18181b)',
                      border: '1px solid var(--divider, #27272a)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: 13,
                    }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: 4 }}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value, data?.currency || 'EUR'),
                      name === 'gross' ? 'Brut' : 'Net',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="gross"
                    stroke="#10b981"
                    fill="url(#dashGross)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#10b981', stroke: '#18181b', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="net"
                    stroke="#6366f1"
                    fill="url(#dashNet)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#6366f1', stroke: '#18181b', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-3 justify-center">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] text-default-500">Brut</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span className="text-[11px] text-default-500">Net</span>
              </div>
            </div>
          </div>
        )}

        {/* ===== 3. TOP RELEASES - Horizontal Scroll ===== */}
        {chartsLoading ? (
          <div className="animate-pulse">
            <div className="h-4 w-32 bg-content2 rounded mb-3" />
            <div className="flex gap-3 overflow-hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-36 flex-shrink-0 bg-content1 border border-divider rounded-2xl p-3">
                  <div className="w-full aspect-square bg-content2 rounded-xl mb-2" />
                  <div className="h-3 w-20 bg-content2 rounded mb-1" />
                  <div className="h-2 w-14 bg-content2 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : topReleases.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-semibold text-default-400 uppercase tracking-wider">
                Top Sorties
              </h2>
              <Link href="/releases" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                Tout voir
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide"
                 style={{ WebkitOverflowScrolling: 'touch' }}>
              {topReleases.map((release, idx) => (
                <div
                  key={release.upc}
                  className="w-[140px] flex-shrink-0 bg-content1 border border-divider rounded-2xl p-3 snap-start"
                >
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-2.5 bg-content2">
                    {release.artwork_url ? (
                      <img
                        src={release.artwork_url}
                        alt={release.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500/20 to-purple-500/10">
                        <svg className="w-8 h-8 text-default-500/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                      #{idx + 1}
                    </div>
                  </div>
                  <p className="text-foreground font-semibold text-xs truncate">{release.title}</p>
                  <p className="text-default-500 text-[10px] mt-0.5">{formatNumber(release.streams)} streams</p>
                  <p className="text-emerald-400 font-bold text-xs mt-1">
                    {formatCurrency(release.gross, release.currency)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== 4. PLATFORM BREAKDOWN ===== */}
        {chartsLoading ? (
          <div className="bg-content1 border border-divider rounded-2xl p-5 animate-pulse">
            <div className="h-4 w-48 bg-content2 rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-content2 rounded-xl" />
              ))}
            </div>
          </div>
        ) : sortedPlatforms.length > 0 && (
          <div className="bg-content1 border border-divider rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-default-400 uppercase tracking-wider">
                Plateformes
              </h2>
              <Link href="/stats" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                Details
              </Link>
            </div>
            <div className="space-y-3">
              {sortedPlatforms.map((p) => {
                const revenue = parseFloat(p.gross);
                const barWidth = maxPlatformRevenue > 0 ? (revenue / maxPlatformRevenue) * 100 : 0;
                const color = PLATFORM_COLORS[p.platform] || PLATFORM_COLORS.other;

                return (
                  <div key={p.platform}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm text-foreground font-medium">
                          {PLATFORM_ICONS[p.platform] || p.platform_label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-default-500">{p.percentage.toFixed(1)}%</span>
                        <span className="text-sm text-emerald-400 font-semibold tabular-nums">
                          {formatCurrency(p.gross)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-content2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== 5. RECENT ACTIVITY ===== */}
        {!chartsLoading && notifications.length > 0 && (
          <div className="bg-content1 border border-divider rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-default-400 uppercase tracking-wider mb-4">
              Activite recente
            </h2>
            <div className="space-y-0.5">
              {notifications.slice(0, 5).map((notif, idx) => (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                    notif.link ? 'hover:bg-content2/50 cursor-pointer' : ''
                  }`}
                  onClick={() => {
                    if (notif.link) window.location.href = notif.link;
                  }}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    notif.is_read ? 'bg-content2' : 'bg-indigo-500/10'
                  }`}>
                    {notif.notification_type === 'payment' ? (
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : notif.notification_type === 'statement' ? (
                      <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    ) : notif.notification_type === 'release' ? (
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${notif.is_read ? 'text-default-400' : 'text-foreground font-medium'}`}>
                      {notif.title}
                    </p>
                    {notif.message && (
                      <p className="text-xs text-default-500 mt-0.5 truncate">{notif.message}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-default-500 flex-shrink-0 mt-0.5">
                    {formatTimeAgo(notif.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== QUICK LINKS ===== */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-default-500 uppercase tracking-wider px-1">
            Navigation
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/releases"
              className="flex flex-col items-center gap-2 p-4 bg-content1 border border-divider rounded-2xl hover:border-indigo-500/50 transition-colors"
            >
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <span className="text-xs font-medium text-foreground">Sorties</span>
            </Link>

            <Link
              href="/tracks"
              className="flex flex-col items-center gap-2 p-4 bg-content1 border border-divider rounded-2xl hover:border-indigo-500/50 transition-colors"
            >
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <span className="text-xs font-medium text-foreground">Titres</span>
            </Link>

            <Link
              href="/payments"
              className="flex flex-col items-center gap-2 p-4 bg-content1 border border-divider rounded-2xl hover:border-indigo-500/50 transition-colors"
            >
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-foreground">Paiements</span>
            </Link>

            <Link
              href="/stats"
              className="flex flex-col items-center gap-2 p-4 bg-content1 border border-divider rounded-2xl hover:border-indigo-500/50 transition-colors"
            >
              <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-foreground">Stats</span>
            </Link>

            <Link
              href="/expenses"
              className="flex flex-col items-center gap-2 p-4 bg-content1 border border-divider rounded-2xl hover:border-indigo-500/50 transition-colors"
            >
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-foreground">Frais</span>
            </Link>

            <Link
              href="/support"
              className="flex flex-col items-center gap-2 p-4 bg-content1 border border-divider rounded-2xl hover:border-indigo-500/50 transition-colors relative"
            >
              {unreadTickets > 0 && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
                  {unreadTickets}
                </span>
              )}
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-foreground">Support</span>
            </Link>
          </div>
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
