'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getArtistTracks, ArtistTrack } from '@/lib/api';

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
    return parseFloat(value).toLocaleString('en-US', { style: 'currency', currency });
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toLocaleString('en-US');
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-content2 transition-colors">
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="font-semibold text-foreground">My Tracks</h1>
            <p className="text-xs text-secondary-500">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-24 space-y-4">
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Summary Stats */}
        {tracks.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-content1 rounded-2xl p-3 text-center">
              <p className="text-xs text-secondary-500 mb-1">Tracks</p>
              <p className="text-lg font-bold text-foreground">{tracks.length}</p>
            </div>
            <div className="bg-content1 rounded-2xl p-3 text-center">
              <p className="text-xs text-secondary-500 mb-1">Streams</p>
              <p className="text-lg font-bold text-foreground">{formatNumber(totalStreams)}</p>
            </div>
            <div className="bg-content1 rounded-2xl p-3 text-center">
              <p className="text-xs text-secondary-500 mb-1">Revenue</p>
              <p className="text-lg font-bold text-success">{formatCurrency(totalRevenue.toFixed(2), currency)}</p>
            </div>
          </div>
        )}

        {/* Search + Sort */}
        {tracks.length > 0 && (
          <div className="space-y-3">
            {/* Search bar */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by title or ISRC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-content1 border border-divider rounded-xl text-sm text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-foreground"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Sort pills */}
            <div className="flex gap-2">
              {([
                { key: 'revenue' as SortKey, label: 'Revenue' },
                { key: 'streams' as SortKey, label: 'Streams' },
                { key: 'name' as SortKey, label: 'Name' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    sortBy === opt.key
                      ? 'bg-primary text-white'
                      : 'bg-content1 text-secondary-500 hover:bg-content2'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {search && (
                <span className="px-3 py-1.5 text-xs text-secondary-400">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {tracks.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-content2 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="text-secondary-500">No tracks yet</p>
          </div>
        )}

        {/* No search results */}
        {tracks.length > 0 && filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-secondary-500 text-sm">No tracks match your search</p>
            <button onClick={() => setSearch('')} className="text-primary text-sm mt-2 hover:underline">
              Clear search
            </button>
          </div>
        )}

        {/* Track list */}
        <div className="space-y-0">
          {filtered.map((track, index) => (
            <div key={`${track.isrc}-${index}`}>
              <div className="flex items-center gap-3 py-3">
                {/* Music note icon */}
                <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>

                {/* Title + release + ISRC */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate text-sm">{track.title}</p>
                  {track.release_title && (
                    <p className="text-xs text-secondary-500 truncate">{track.release_title}</p>
                  )}
                  <p className="font-mono text-[10px] text-secondary-400 mt-0.5">{track.isrc}</p>
                </div>

                {/* Streams + revenue */}
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-success text-sm">{formatCurrency(track.net, track.currency)}</p>
                  <p className="text-xs text-secondary-500">{formatNumber(track.streams)} streams</p>
                </div>
              </div>

              {/* Separator */}
              {index < filtered.length - 1 && (
                <div className="border-b border-divider ml-13" />
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
