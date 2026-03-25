'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getArtistReleases, ArtistRelease } from '@/lib/api';

type SortKey = 'revenue' | 'streams' | 'name';

export default function ReleasesPage() {
  const { artist, loading: authLoading } = useAuth();
  const [releases, setReleases] = useState<ArtistRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('revenue');

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

  const formatNumber = (value: number) => {
    return value.toLocaleString('fr-FR');
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
        case 'name':
          return a.title.localeCompare(b.title, 'fr');
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
            <h1 className="font-semibold text-foreground">Mes Sorties</h1>
            <p className="text-xs text-secondary-500">{releases.length} album{releases.length > 1 ? 's' : ''}</p>
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
        {releases.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-content1 border border-divider rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{releases.length}</p>
              <p className="text-xs text-secondary-500">Sorties</p>
            </div>
            <div className="bg-content1 border border-divider rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{formatNumber(totalStreams)}</p>
              <p className="text-xs text-secondary-500">Streams</p>
            </div>
            <div className="bg-content1 border border-divider rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-success">{totalRevenue.toLocaleString('fr-FR', { style: 'currency', currency })}</p>
              <p className="text-xs text-secondary-500">Revenus</p>
            </div>
          </div>
        )}

        {/* Search + Sort */}
        {releases.length > 0 && (
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-content1 border border-divider rounded-xl text-sm text-foreground placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="px-3 py-2.5 bg-content1 border border-divider rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="revenue">Revenus</option>
              <option value="streams">Streams</option>
              <option value="name">Nom</option>
            </select>
          </div>
        )}

        {/* Empty state */}
        {releases.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-content2 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="text-secondary-500">Aucune sortie pour le moment</p>
          </div>
        )}

        {/* No search results */}
        {releases.length > 0 && filteredAndSorted.length === 0 && (
          <div className="text-center py-8">
            <p className="text-secondary-500 text-sm">Aucun résultat pour &ldquo;{search}&rdquo;</p>
          </div>
        )}

        {/* Release Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSorted.map((release) => (
            <div
              key={release.upc}
              className="bg-content1 border border-divider rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform duration-200"
            >
              {/* Artwork */}
              <div className="aspect-square relative bg-content2">
                {release.artwork_url ? (
                  <img
                    src={release.artwork_url}
                    alt={release.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                    <svg className="w-16 h-16 text-primary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
                {/* Track count badge */}
                <span className="absolute top-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
                  {release.track_count} titre{release.track_count > 1 ? 's' : ''}
                </span>
              </div>

              {/* Info */}
              <div className="p-3 space-y-2">
                <div>
                  <p className="font-semibold text-foreground truncate">{release.title}</p>
                  <p className="text-xs text-secondary-400 font-mono">{release.upc}</p>
                </div>

                <div className="flex items-center justify-between">
                  {/* Streams */}
                  <div className="flex items-center gap-1.5 text-secondary-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm">{formatNumber(release.streams)}</span>
                  </div>
                  {/* Revenue */}
                  <p className="text-sm font-semibold text-success">
                    {formatCurrency(release.net, release.currency)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
