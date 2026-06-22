'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import { getArtistReleases, ArtistRelease } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, Eyebrow, Segmented, fmtMoney, fmtNum } from '@/components/roy/ui';
import { IconSearch } from '@/components/roy/icons';

const COVER = { background: 'var(--cover)' } as const;

type SortKey = 'date' | 'revenue' | 'streams';

export default function ReleasesPage() {
  const { artist, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [releases, setReleases] = useState<ArtistRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('revenue');
  const [expandedUpc, setExpandedUpc] = useState<string | null>(null);

  useEffect(() => {
    if (artist) {
      loadReleases();
    }
  }, [artist]);

  const loadReleases = async () => {
    try {
      const data = await getArtistReleases();
      setReleases(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('fr-FR', { style: 'currency', currency });
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...releases];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.upc.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'revenue':
          return parseFloat(b.net) - parseFloat(a.net);
        case 'streams':
          return b.streams - a.streams;
        case 'date':
          return b.upc.localeCompare(a.upc); // UPC order approximates chronological
        default:
          return 0;
      }
    });

    return result;
  }, [releases, search, sortBy]);

  const totalStreams = useMemo(
    () => releases.reduce((sum, r) => sum + r.streams, 0),
    [releases]
  );

  const totalRevenue = useMemo(
    () => releases.reduce((sum, r) => sum + parseFloat(r.net), 0),
    [releases]
  );

  const currency = releases[0]?.currency || 'EUR';

  const releaseMeta = (r: ArtistRelease) =>
    `${r.track_count} titre${r.track_count > 1 ? 's' : ''} · ${fmtNum(r.streams)}`;

  const searchBox = (full = false) => (
    <div className={`flex items-center gap-2.5 rounded-[14px] bg-surface border border-line px-3.5 py-2.5 ${full ? '' : 'w-[260px]'}`}>
      <IconSearch size={16} className="text-ink-faint" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('releases.search')}
        className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
      />
    </div>
  );

  const sortControl = (
    <Segmented
      options={[
        { value: 'revenue' as SortKey, label: t('releases.sortRevenue') },
        { value: 'streams' as SortKey, label: t('dashboard.streams') },
        { value: 'date' as SortKey, label: t('releases.sortDate') },
      ]}
      value={sortBy}
      onChange={setSortBy}
    />
  );

  const expandedDetail = (release: ArtistRelease) => (
    <div className="border-t border-line px-3.5 py-3 space-y-2 bg-surface-2/40">
      <div className="flex justify-between text-[12px]">
        <span className="text-ink-faint">{t('releases.gross')}</span>
        <span className="text-ink font-medium roy-num">{formatCurrency(release.gross, release.currency)}</span>
      </div>
      <div className="flex justify-between text-[12px]">
        <span className="text-ink-faint">{t('releases.net')}</span>
        <span className="text-accent font-semibold roy-num">{formatCurrency(release.net, release.currency)}</span>
      </div>
      <div className="flex justify-between text-[12px]">
        <span className="text-ink-faint">Streams</span>
        <span className="text-ink font-medium roy-num">{release.streams.toLocaleString('fr-FR')}</span>
      </div>
      <div className="flex justify-between text-[12px]">
        <span className="text-ink-faint">Titres</span>
        <span className="text-ink font-medium roy-num">{release.track_count}</span>
      </div>
      <div className="flex justify-between text-[12px]">
        <span className="text-ink-faint">UPC</span>
        <span className="text-ink font-mono text-[11px]">{release.upc}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-app">
      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center justify-between px-7 py-[22px] border-b border-line">
        <div>
          <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">{t('releases.title')}</div>
          <div className="text-[12.5px] text-ink-faint mt-0.5">
            {releases.length} album{releases.length > 1 ? 's' : ''} · {fmtNum(totalStreams)} streams
          </div>
        </div>
        {releases.length > 0 && searchBox()}
      </div>

      <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-none mx-auto">
        {error && (
          <div className="p-3 rounded-2xl bg-neg/10 border border-neg/20 text-neg text-sm mb-3">{error}</div>
        )}

        {(authLoading || loading) ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" color="primary" /></div>
        ) : (<>
          {/* Mobile header */}
          <div className="lg:hidden mb-4">
            <Eyebrow>{t('dashboard.releases')}</Eyebrow>
            <div className="flex items-baseline gap-2.5 mt-1.5">
              <div className="roy-num text-[44px] font-bold text-ink leading-none">{releases.length}</div>
              <div className="text-[14px] text-ink-muted">album{releases.length > 1 ? 's' : ''} · {fmtNum(totalStreams)} streams</div>
            </div>
            {releases.length > 0 && (
              <>
                <div className="mt-5">{searchBox(true)}</div>
                <div className="mt-3.5">{sortControl}</div>
              </>
            )}
          </div>

          {/* Desktop summary + sort */}
          {releases.length > 0 && (
            <div className="hidden lg:grid grid-cols-[1fr_1fr_1.2fr] gap-4 mb-5">
              <Card><Eyebrow className="text-[9.5px]">{t('dashboard.releases')}</Eyebrow><div className="roy-num text-[30px] font-bold text-ink leading-none mt-2.5">{releases.length}</div></Card>
              <Card><Eyebrow className="text-[9.5px]">{t('dashboard.streams')}</Eyebrow><div className="roy-num text-[30px] font-bold text-ink leading-none mt-2.5">{fmtNum(totalStreams)}</div></Card>
              <Card hero className="flex flex-col justify-between">
                <Eyebrow className="text-[9.5px]">{t('releases.sortRevenue')}</Eyebrow>
                <div className="roy-num text-[30px] font-bold text-ink leading-none mt-2.5">{fmtMoney(totalRevenue, currency)}</div>
              </Card>
            </div>
          )}

          <div className="hidden lg:flex items-center justify-end mb-3.5">
            {releases.length > 0 && sortControl}
          </div>

          {/* Empty state */}
          {releases.length === 0 && !error && (
            <Card className="text-center py-12">
              <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-4" style={COVER} />
              <p className="text-ink-faint text-sm">{t('releases.noReleases')}</p>
            </Card>
          )}

          {/* No search results */}
          {releases.length > 0 && filteredAndSorted.length === 0 && (
            <div className="text-center py-10 text-ink-faint text-sm">
              Aucun resultat pour &ldquo;{search}&rdquo;
            </div>
          )}

          {/* Mobile rows */}
          {filteredAndSorted.length > 0 && (
            <div className="lg:hidden flex flex-col">
              {filteredAndSorted.map((release, i) => {
                const isExpanded = expandedUpc === release.upc;
                return (
                  <div key={release.upc} className={i < filteredAndSorted.length - 1 ? 'border-b border-line' : ''}>
                    <button
                      onClick={() => setExpandedUpc(isExpanded ? null : release.upc)}
                      className="w-full flex items-center gap-3.5 py-2.5 text-left"
                    >
                      <div className="w-[46px] h-[46px] rounded-[10px] overflow-hidden shrink-0" style={COVER}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {release.artwork_url && <img src={release.artwork_url} alt={release.title} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-semibold text-ink truncate">{release.title}</div>
                        <div className="text-[11px] text-ink-faint mt-0.5 truncate">{releaseMeta(release)}</div>
                      </div>
                      <span className="roy-num text-[13px] font-bold text-ink">{formatCurrency(release.net, release.currency)}</span>
                    </button>
                    {isExpanded && expandedDetail(release)}
                  </div>
                );
              })}
            </div>
          )}

          {/* Desktop release grid */}
          {filteredAndSorted.length > 0 && (
            <div className="hidden lg:grid grid-cols-4 gap-4">
              {filteredAndSorted.map((release) => {
                const isExpanded = expandedUpc === release.upc;
                return (
                  <div key={release.upc}>
                    <button
                      onClick={() => setExpandedUpc(isExpanded ? null : release.upc)}
                      className="block w-full text-left"
                    >
                      <div className="aspect-square rounded-[14px] overflow-hidden" style={COVER}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {release.artwork_url && <img src={release.artwork_url} alt={release.title} className="w-full h-full object-cover" />}
                      </div>
                      <div className="text-[13.5px] font-semibold text-ink mt-2.5 truncate">{release.title}</div>
                      <div className="text-[11.5px] text-ink-faint mt-0.5 truncate">{releaseMeta(release)}</div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11.5px] text-ink-faint">{fmtNum(release.streams)} streams</span>
                        <span className="roy-num text-[12.5px] font-semibold text-accent">{formatCurrency(release.net, release.currency)}</span>
                      </div>
                    </button>
                    {isExpanded && (
                      <Card padded={false} className="mt-2 overflow-hidden">{expandedDetail(release)}</Card>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>)}
      </main>
    </div>
  );
}
