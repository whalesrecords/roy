'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
import { useLanguage } from '@/contexts/LanguageContext';

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
  tidal: '#e8e8e8',
  other: '#818cf8',
};

export default function DashboardPage() {
  const { artist, loading: authLoading } = useAuth();
  const { t } = useLanguage();

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

  // Stage 1 — critique
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

  // Stage 2 — graphiques (non-bloquant)
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
      } catch { /* non-critique */ }
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

  if (!artist && !authLoading) return null;

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
      <main className="px-4 py-4 pb-28 space-y-3 max-w-lg mx-auto">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" color="primary" />
          </div>
        )}
        {/* Alerts */}
        {!loading && error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}
        {!loading && artist && paymentSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-emerald-400 text-sm">{paymentSuccess}</p>
          </div>
        )}

        {/* ── Main content (only when loaded) ── */}
        {!loading && artist && (<>
        {/* ── Hero balance card — flat, sans gradient ── */}
        <div className="relative overflow-hidden rounded-3xl bg-content1 border border-white/[0.06] p-6">
          {/* Ligne accent indigo en haut */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          {/* Artist identity */}
          <div className="flex items-center gap-3 mb-5">
            {artist.artwork_url ? (
              <img
                src={artist.artwork_url}
                alt={artist.name}
                className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-lg shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center border border-white/10 shrink-0">
                <span className="text-primary text-2xl font-bold">{artist.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <p className="font-bold text-foreground text-base leading-tight">{artist.name}</p>
              {labelSettings?.label_name && (
                <p className="text-xs text-default-400 leading-tight mt-0.5">{labelSettings.label_name}</p>
              )}
            </div>
          </div>

          <p className="text-[10px] font-semibold text-default-400 uppercase tracking-[0.15em] mb-3">
            {t('dashboard.balance')}
          </p>
          <p className="num-display text-[2.75rem] font-black text-foreground leading-none mb-1">
            {data ? fmt(data.total_net) : '—'}
          </p>
          <p className="text-sm text-default-400 mb-5">
            {t('dashboard.gross')} · {data ? fmt(data.total_gross) : '—'}
          </p>

          {data && parseFloat(data.advance_balance) > 0 && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-500/10 rounded-xl border border-amber-500/15">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-xs text-amber-400">
                {t('dashboard.advanceRemaining')} · {fmt(data.advance_balance)}
              </span>
            </div>
          )}

          {totalUnpaid > 0 && (
            <button
              onClick={handleRequestPayment}
              disabled={requestingPayment}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-4 rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {requestingPayment ? (
                <Spinner size="sm" color="white" />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  {t('dashboard.requestPayment')}
                </>
              )}
            </button>
          )}
        </div>

        {/* ── Quick stats ── */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: data?.release_count ?? 0, label: t('dashboard.releases') },
            { value: data?.track_count ?? 0, label: t('dashboard.tracks') },
            { value: fmtN(data?.total_streams ?? 0), label: t('dashboard.streams') },
          ].map(({ value, label }) => (
            <div key={label} className="bg-content1 border border-divider rounded-2xl p-3.5 text-center">
              <p className="num-display text-xl font-bold text-foreground">{value}</p>
              <p className="text-[10px] text-default-400 mt-1 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Revenue chart ── */}
        {chartsLoading ? (
          <div className="bg-content1 border border-divider rounded-2xl p-5 h-44 animate-pulse" />
        ) : chartData.length > 0 && (
          <div className="bg-content1 border border-divider rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold text-default-400 uppercase tracking-widest">{t('nav.revenue')}</p>
              <Link href="/statements" className="text-[11px] text-primary">{t('dashboard.seeStatements')}</Link>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number, name: string) => [fmt(v), name === 'gross' ? t('dashboard.gross') : t('dashboard.net')]}
                  />
                  <Area type="monotone" dataKey="gross" stroke="#34d399" fill="url(#gGross)" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                  <Area type="monotone" dataKey="net" stroke="#818cf8" fill="url(#gNet)" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 justify-center">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-default-400">{t('dashboard.gross')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span className="text-[10px] text-default-400">{t('dashboard.net')}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Top 3 plateformes ── */}
        {!chartsLoading && top3Platforms.length > 0 && (
          <div className="bg-content1 border border-divider rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold text-default-400 uppercase tracking-widest">{t('dashboard.topPlatforms')}</p>
              <Link href="/musique" className="text-[11px] text-primary">{t('dashboard.seeAll')}</Link>
            </div>
            <div className="space-y-3">
              {top3Platforms.map(p => {
                const rev = parseFloat(p.gross);
                const pct = maxPlatformRev > 0 ? (rev / maxPlatformRev) * 100 : 0;
                const color = PLATFORM_COLORS[p.platform] || PLATFORM_COLORS.other;
                return (
                  <div key={p.platform}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-sm text-foreground">{p.platform_label}</span>
                      </div>
                      <span className="text-sm text-emerald-400 font-semibold tabular-nums">{fmt(p.gross)}</span>
                    </div>
                    <div className="h-px bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </>)}
      </main>
    </div>
  );
}
