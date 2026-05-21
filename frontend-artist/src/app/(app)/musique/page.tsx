'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import {
  getArtistReleases,
  getArtistTracks,
  getPlatformStats,
  getQuarterlyRevenue,
  getAvailableYears,
  ArtistRelease,
  ArtistTrack,
  PlatformStats,
  QuarterlyRevenue,
} from '@/lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type Tab = 'sorties' | 'titres' | 'stats';

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

export default function MusiquePage() {
  const { artist, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('sorties');

  // Data per tab (loaded lazily)
  const [releases, setReleases] = useState<ArtistRelease[]>([]);
  const [tracks, setTracks] = useState<ArtistTrack[]>([]);
  const [platforms, setPlatforms] = useState<PlatformStats[]>([]);
  const [quarterly, setQuarterly] = useState<QuarterlyRevenue[]>([]);

  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!artist || loadedTabs.has(tab)) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        if (tab === 'sorties') {
          setReleases(await getArtistReleases());
        } else if (tab === 'titres') {
          setTracks(await getArtistTracks());
        } else {
          const [platformData, yearsData] = await Promise.all([
            getPlatformStats(),
            getAvailableYears(),
          ]);
          setPlatforms(platformData);
          const year = yearsData.default_year;
          if (year) {
            const q = await getQuarterlyRevenue(year);
            setQuarterly(q.filter(x => parseFloat(x.gross) > 0));
          }
        }
        setLoadedTabs(prev => new Set([...Array.from(prev), tab]));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [tab, artist]);

  const fmt = (v: string | number, currency = 'EUR') =>
    (typeof v === 'string' ? parseFloat(v) : v)
      .toLocaleString('fr-FR', { style: 'currency', currency });

  const fmtN = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K`
    : v.toLocaleString('fr-FR');

  // Filtered releases
  const filteredReleases = useMemo(() => {
    const q = search.toLowerCase();
    return [...releases]
      .filter(r => !q || r.title.toLowerCase().includes(q) || r.upc.includes(q))
      .sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross));
  }, [releases, search]);

  // Filtered tracks
  const filteredTracks = useMemo(() => {
    const q = search.toLowerCase();
    return [...tracks]
      .filter(t => !q || t.title.toLowerCase().includes(q) || (t.isrc || '').toLowerCase().includes(q))
      .sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross));
  }, [tracks, search]);

  const sortedPlatforms = useMemo(
    () => [...platforms].sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross)),
    [platforms]
  );

  const maxRev = sortedPlatforms.length > 0 ? parseFloat(sortedPlatforms[0].gross) : 0;

  const chartData = quarterly.map(q => ({
    name: `${q.quarter} ${q.year}`,
    brut: parseFloat(q.gross),
    streams: q.streams,
  }));

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'sorties', label: 'Sorties' },
    { id: 'titres', label: 'Titres' },
    { id: 'stats', label: 'Stats' },
  ];

  return (
    <div className="min-h-screen bg-background safe-top">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-divider">
        <div className="px-4 pt-4 pb-0 max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-foreground mb-3">Musique</h1>
          {/* Tabs */}
          <div className="flex gap-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setSearch(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-t-xl transition-colors border-b-2 ${
                  tab === t.id
                    ? 'text-primary border-primary'
                    : 'text-default-400 border-transparent hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-28 max-w-lg mx-auto space-y-3">
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Search bar (Sorties + Titres) */}
        {tab !== 'stats' && (
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === 'sorties' ? 'Rechercher une sortie…' : 'Rechercher un titre…'}
              className="w-full pl-9 pr-4 py-2.5 bg-content1 border border-divider rounded-xl text-sm text-foreground placeholder:text-default-400 focus:outline-none focus:border-primary/50"
            />
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-10">
            <Spinner color="primary" />
          </div>
        )}

        {/* ── TAB: SORTIES ── */}
        {!loading && tab === 'sorties' && (
          <div className="space-y-2">
            {filteredReleases.length === 0 && (
              <p className="text-default-500 text-sm text-center py-10">Aucune sortie trouvée</p>
            )}
            {filteredReleases.map(release => (
              <div key={release.upc} className="bg-content1 border border-divider rounded-2xl flex items-center gap-3 px-4 py-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-content2 flex-shrink-0">
                  {release.artwork_url ? (
                    <img src={release.artwork_url} alt={release.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-default-500/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{release.title}</p>
                  <p className="text-xs text-default-500 mt-0.5">{release.track_count} titre{release.track_count !== 1 ? 's' : ''} · {fmtN(release.streams)} streams</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-emerald-400 font-bold text-sm">{fmt(release.gross, release.currency)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: TITRES ── */}
        {!loading && tab === 'titres' && (
          <div className="space-y-2">
            {filteredTracks.length === 0 && (
              <p className="text-default-500 text-sm text-center py-10">Aucun titre trouvé</p>
            )}
            {filteredTracks.map((t, i) => (
              <div key={t.isrc || t.title} className="bg-content1 border border-divider rounded-2xl flex items-center gap-3 px-4 py-3">
                <span className="text-xs font-bold text-default-400 w-5 text-center flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{t.title}</p>
                  {t.isrc && <p className="text-[10px] text-default-500">{t.isrc}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-emerald-400 font-bold text-sm">{fmt(t.gross)}</p>
                  <p className="text-[10px] text-default-500">{fmtN(t.streams)} streams</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: STATS ── */}
        {!loading && tab === 'stats' && (
          <div className="space-y-4">
            {/* Quarterly chart */}
            {chartData.length > 0 && (
              <div className="bg-content1 border border-divider rounded-2xl p-5">
                <h3 className="text-xs font-semibold text-default-400 uppercase tracking-wider mb-4">Revenus par trimestre</h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--divider,#27272a)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--content1,#18181b)', border: '1px solid var(--divider,#27272a)', borderRadius: 12, fontSize: 12 }}
                        formatter={(v: number) => [fmt(v), 'Brut']}
                      />
                      <Bar dataKey="brut" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Platforms */}
            {sortedPlatforms.length > 0 && (
              <div className="bg-content1 border border-divider rounded-2xl p-5">
                <h3 className="text-xs font-semibold text-default-400 uppercase tracking-wider mb-4">Plateformes</h3>
                <div className="space-y-3">
                  {sortedPlatforms.map(p => {
                    const rev = parseFloat(p.gross);
                    const pct = maxRev > 0 ? (rev / maxRev) * 100 : 0;
                    const color = PLATFORM_COLORS[p.platform] || PLATFORM_COLORS.other;
                    return (
                      <div key={p.platform}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-sm text-foreground">{p.platform_label}</span>
                            <span className="text-xs text-default-500">{p.percentage.toFixed(0)}%</span>
                          </div>
                          <span className="text-sm text-emerald-400 font-semibold tabular-nums">{fmt(p.gross)}</span>
                        </div>
                        <div className="h-1 bg-content2 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {sortedPlatforms.length === 0 && chartData.length === 0 && (
              <p className="text-default-500 text-sm text-center py-10">Pas encore de données</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
