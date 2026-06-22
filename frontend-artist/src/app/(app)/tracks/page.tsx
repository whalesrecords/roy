'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import { getArtistTracks, ArtistTrack } from '@/lib/api';
import { Card, Eyebrow, Segmented, fmtMoney, fmtNum } from '@/components/roy/ui';
import { IconSearch } from '@/components/roy/icons';

const COVER = { background: 'var(--cover)' } as const;

type SortKey = 'revenue' | 'streams' | 'name';

export default function TracksPage() {
  const { artist, loading: authLoading } = useAuth();
  const [tracks, setTracks] = useState<ArtistTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('revenue');

  useEffect(() => {
    if (artist) {
      loadTracks();
    }
  }, [artist]);

  const loadTracks = async () => {
    try {
      const data = await getArtistTracks();
      setTracks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('fr-FR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Summary stats
  const totalStreams = tracks.reduce((sum, t) => sum + t.streams, 0);
  const totalRevenue = tracks.reduce((sum, t) => sum + parseFloat(t.net), 0);
  const currency = tracks[0]?.currency || 'EUR';

  // Filter + sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = tracks;
    if (q) {
      result = tracks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.isrc.toLowerCase().includes(q) ||
          (t.release_title && t.release_title.toLowerCase().includes(q))
      );
    }
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'revenue':
          return parseFloat(b.net) - parseFloat(a.net);
        case 'streams':
          return b.streams - a.streams;
        case 'name':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }, [tracks, search, sortBy]);

  const searchBox = (full = false) => (
    <div className={`flex items-center gap-2.5 rounded-[14px] bg-surface border border-line px-3.5 py-2.5 ${full ? '' : 'w-[260px]'}`}>
      <IconSearch size={16} className="text-ink-faint" />
      <input
        type="text"
        placeholder="Search by title or ISRC…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
      />
      {search && (
        <button onClick={() => setSearch('')} className="text-ink-faint hover:text-ink shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );

  const sortControl = (
    <Segmented
      options={[
        { value: 'revenue' as SortKey, label: 'Revenue' },
        { value: 'streams' as SortKey, label: 'Streams' },
        { value: 'name' as SortKey, label: 'Name' },
      ]}
      value={sortBy}
      onChange={setSortBy}
    />
  );

  return (
    <div className="min-h-screen bg-app">
      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center justify-between px-7 py-[22px] border-b border-line">
        <div>
          <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">My Tracks</div>
          <div className="text-[12.5px] text-ink-faint mt-0.5">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''} · {fmtNum(totalStreams)} streams
          </div>
        </div>
        {tracks.length > 0 && searchBox()}
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
            <Eyebrow>Tracks</Eyebrow>
            <div className="flex items-baseline gap-2.5 mt-1.5">
              <div className="roy-num text-[44px] font-bold text-ink leading-none">{tracks.length}</div>
              <div className="text-[14px] text-ink-muted">track{tracks.length !== 1 ? 's' : ''} · {fmtNum(totalStreams)} streams</div>
            </div>
            {tracks.length > 0 && (
              <>
                <div className="mt-5">{searchBox(true)}</div>
                <div className="mt-3.5 flex items-center gap-3">
                  {sortControl}
                  {search && (
                    <span className="text-[12px] text-ink-faint">
                      {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Desktop summary + sort */}
          {tracks.length > 0 && (
            <>
              <div className="hidden lg:grid grid-cols-3 gap-4 mb-5">
                <Card><Eyebrow className="text-[9.5px]">Tracks</Eyebrow><div className="roy-num text-[30px] font-bold text-ink leading-none mt-2.5">{tracks.length}</div></Card>
                <Card><Eyebrow className="text-[9.5px]">Streams</Eyebrow><div className="roy-num text-[30px] font-bold text-ink leading-none mt-2.5">{fmtNum(totalStreams)}</div></Card>
                <Card hero><Eyebrow className="text-[9.5px]">Revenue</Eyebrow><div className="roy-num text-[30px] font-bold text-ink leading-none mt-2.5">{fmtMoney(totalRevenue, currency)}</div></Card>
              </div>
              <div className="hidden lg:flex items-center justify-end mb-3.5">{sortControl}</div>
            </>
          )}

          {/* Empty state */}
          {tracks.length === 0 && !error && (
            <Card className="text-center py-12">
              <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-4" style={COVER} />
              <p className="text-ink-faint text-sm">No tracks yet</p>
            </Card>
          )}

          {/* No search results */}
          {tracks.length > 0 && filtered.length === 0 && (
            <div className="text-center py-10">
              <p className="text-ink-faint text-sm">No tracks match your search</p>
              <button onClick={() => setSearch('')} className="text-accent text-sm mt-2 font-semibold hover:underline">
                Clear search
              </button>
            </div>
          )}

          {/* Mobile rows */}
          {filtered.length > 0 && (
            <div className="lg:hidden flex flex-col">
              {filtered.map((track, index) => (
                <div
                  key={`${track.isrc}-${index}`}
                  className={`flex items-center gap-3.5 py-2.5 ${index < filtered.length - 1 ? 'border-b border-line' : ''}`}
                >
                  <div className="w-[46px] h-[46px] rounded-[10px] overflow-hidden shrink-0" style={COVER}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {track.artwork_url && <img src={track.artwork_url} alt={track.title} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-ink truncate">{track.title}</div>
                    <div className="text-[11px] text-ink-faint mt-0.5 truncate">
                      {(track.release_title || 'Single')} · {fmtNum(track.streams)} streams
                    </div>
                    <div className="font-mono text-[10px] text-ink-faint mt-0.5">{track.isrc}</div>
                  </div>
                  <span className="roy-num text-[13px] font-bold text-ink">{formatCurrency(track.net, track.currency)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Desktop tracks table */}
          {filtered.length > 0 && (
            <Card padded={false} className="hidden lg:block overflow-hidden rounded-[18px]">
              <div className="grid grid-cols-[2fr_1.4fr_1fr_1fr] px-6 py-3 border-b border-line roy-eyebrow text-[10px]">
                <span>Track</span><span>Release</span><span className="text-right">Streams</span><span className="text-right">Revenue</span>
              </div>
              {filtered.map((track, index) => (
                <div key={`${track.isrc}-${index}`} className="grid grid-cols-[2fr_1.4fr_1fr_1fr] items-center px-6 py-3 border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                  <span className="flex items-center gap-3.5 min-w-0">
                    <span className="w-[38px] h-[38px] rounded-[9px] overflow-hidden shrink-0 block" style={COVER}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {track.artwork_url && <img src={track.artwork_url} alt={track.title} className="w-full h-full object-cover" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-ink truncate">{track.title}</span>
                      <span className="block font-mono text-[10px] text-ink-faint truncate">{track.isrc}</span>
                    </span>
                  </span>
                  <span className="text-[12.5px] text-ink-muted truncate">{track.release_title || 'Single'}</span>
                  <span className="text-right roy-num text-[13px] text-ink-muted">{fmtNum(track.streams)}</span>
                  <span className="text-right roy-num text-[13px] font-bold text-ink">{formatCurrency(track.net, track.currency)}</span>
                </div>
              ))}
            </Card>
          )}
        </>)}
      </main>
    </div>
  );
}
