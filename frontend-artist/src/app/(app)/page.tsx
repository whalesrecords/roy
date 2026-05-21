'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import {
  getArtistDashboard,
  getQuarterlyRevenue,
  getAvailableYears,
  getPlatformStats,
  getLabelSettings,
  getStatements,
  requestPayment,
  ArtistDashboard,
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
} from 'recharts';
import NotificationBell from '@/components/layout/NotificationBell';

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
  const [labelSettings, setLabelSettings] = useState<LabelSettings | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [quarterly, setQuarterly] = useState<QuarterlyRevenue[]>([]);
  const [platforms, setPlatforms] = useState<PlatformStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestingPayment, setRequestingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  // Stage 1 — critical: dashboard KPIs + settings + statements
  useEffect(() => {
    if (!artist) return;
    let cancelled = false;
    (async () => {
      try {
        const [dashboard, settings, stmts] = await Promise.all([
          getArtistDashboard(),
          getLabelSettings(),
          getStatements(),
        ]);
        if (cancelled) return;
        setData(dashboard);
        setLabelSettings(settings);
        setStatements(stmts);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [artist]);

  // Stage 2 — secondary: chart + platforms (non-blocking)
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      try {
        const [yearsData, platformData] = await Promise.all([
          getAvailableYears(),
          getPlatformStats(),
        ]);
        if (cancelled) return;
        const year = yearsData.default_year;
        const q = year ? await getQuarterlyRevenue(year) : [];
        setQuarterly(q.filter(x => parseFloat(x.gross) > 0));
        setPlatforms(platformData);
      } catch { /* non-critical */ }
      finally { if (!cancelled) setChartsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [data]);

  const unpaidStatements = statements.filter(s => s.status !== 'paid');
  const totalUnpaid = unpaidStatements.reduce((sum, s) => sum + parseFloat(s.net_payable), 0);

  const handleRequestPayment = async () => {
    if (!unpaidStatements.length) return;
    setRequestingPayment(true);
    try {
      await requestPayment(unpaidStatements[0].id);
      setPaymentSuccess('Demande envoyée !');
      setTimeout(() => setPaymentSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setRequestingPayment(false);
    }
  };

  const fmt = (v: string | number, currency = data?.currency || 'EUR') =>
    (typeof v === 'string' ? parseFloat(v) : v)
      .toLocaleString('fr-FR', { style: 'currency', currency });

  const fmtN = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K`
    : v.toLocaleString('fr-FR');

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!artist) return null;

  const chartData = quarterly.map(q => ({
    name: `${q.quarter} ${q.year}`,
    gross: parseFloat(q.gross),
    net: parseFloat(q.net),
  }));

  const top3Platforms = [...platforms]
    .sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross))
    .slice(0, 3);

  const maxPlatformRev = top3Platforms.length > 0 ? parseFloat(top3Platforms[0].gross) : 0;

  return (
    <div className="min-h-screen bg-background safe-top">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            {(labelSettings?.logo_base64 || labelSettings?.logo_url) ? (
              <img
                src={labelSettings.logo_base64 || labelSettings.logo_url}
                alt={labelSettings.label_name || 'Label'}
                className="h-8 w-auto max-w-[100px] object-contain"
              />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">{artist.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground text-sm">{artist.name}</p>
              <p className="text-xs text-default-500">{labelSettings?.label_name || 'Artist Portal'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-content2 transition-colors">
              {theme === 'light'
                ? <svg className="w-5 h-5 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                : <svg className="w-5 h-5 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              }
            </button>
            <Link href="/settings" className="p-2 rounded-full hover:bg-content2 transition-colors">
              <svg className="w-5 h-5 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 pb-28 space-y-4 max-w-lg mx-auto">
        {/* Alerts */}
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}
        {paymentSuccess && (
          <div className="p-3 bg-success/10 border border-success/20 rounded-2xl">
            <p className="text-success text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {paymentSuccess}
            </p>
          </div>
        )}

        {/* ── Hero balance card ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10">
            <p className="text-white/60 text-xs uppercase tracking-widest mb-1">Solde total</p>
            <p className="text-4xl font-extrabold text-white tracking-tight">
              {data ? fmt(data.total_net) : '—'}
            </p>
            <p className="text-white/50 text-sm mt-1 mb-5">
              Brut : {data ? fmt(data.total_gross) : '—'}
            </p>

            {data && parseFloat(data.advance_balance) > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 mb-4 flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-xs">Avance restante</p>
                  <p className="text-amber-300 font-semibold text-sm">{fmt(data.advance_balance)}</p>
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
                className="w-full bg-white text-indigo-700 font-bold py-3 px-4 rounded-xl transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30"
              >
                {requestingPayment
                  ? <><Spinner size="sm" />Envoi...</>
                  : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>Demander un paiement</>
                }
              </button>
            )}
          </div>
        </div>

        {/* ── Quick stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: data?.release_count ?? 0, label: 'Sorties' },
            { value: data?.track_count ?? 0, label: 'Titres' },
            { value: fmtN(data?.total_streams ?? 0), label: 'Streams' },
          ].map(({ value, label }) => (
            <div key={label} className="bg-content1 border border-divider rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-[11px] text-default-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Revenue chart (lazy) ── */}
        {chartsLoading ? (
          <div className="bg-content1 border border-divider rounded-2xl p-5 h-40 animate-pulse" />
        ) : chartData.length > 0 && (
          <div className="bg-content1 border border-divider rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-default-400 uppercase tracking-wider">Revenus</h2>
              <Link href="/statements" className="text-xs text-primary">Voir relevés →</Link>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--divider,#27272a)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--content1,#18181b)', border: '1px solid var(--divider,#27272a)', borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number, name: string) => [fmt(v), name === 'gross' ? 'Brut' : 'Net']}
                  />
                  <Area type="monotone" dataKey="gross" stroke="#10b981" fill="url(#gGross)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  <Area type="monotone" dataKey="net" stroke="#6366f1" fill="url(#gNet)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 justify-center">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[10px] text-default-500">Brut</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /><span className="text-[10px] text-default-500">Net</span></div>
            </div>
          </div>
        )}

        {/* ── Top 3 platforms (lazy) ── */}
        {!chartsLoading && top3Platforms.length > 0 && (
          <div className="bg-content1 border border-divider rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-default-400 uppercase tracking-wider">Top plateformes</h2>
              <Link href="/musique" className="text-xs text-primary">Tout voir →</Link>
            </div>
            <div className="space-y-3">
              {top3Platforms.map(p => {
                const rev = parseFloat(p.gross);
                const pct = maxPlatformRev > 0 ? (rev / maxPlatformRev) * 100 : 0;
                const color = PLATFORM_COLORS[p.platform] || PLATFORM_COLORS.other;
                return (
                  <div key={p.platform}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-sm text-foreground">{p.platform_label}</span>
                      </div>
                      <span className="text-sm text-emerald-400 font-semibold tabular-nums">{fmt(p.gross)}</span>
                    </div>
                    <div className="h-1 bg-content2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
