'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/layout/BottomNav';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getArtistReleases, ArtistRelease } from '@/lib/api';

export default function ReleasesPage() {
  const { artist, loading: authLoading } = useAuth();
  const [releases, setReleases] = useState<ArtistRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            <h1 className="font-semibold text-foreground">My Releases</h1>
            <p className="text-xs text-secondary-500">{releases.length} album{releases.length > 1 ? 's' : ''}</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-24 space-y-3">
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {releases.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-content2 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-secondary-500">No releases yet</p>
          </div>
        )}

        {releases.map((release) => (
          <div
            key={release.upc}
            className="bg-background border border-divider rounded-2xl p-4"
          >
            <div className="flex gap-4">
              {release.artwork_url ? (
                <img
                  src={release.artwork_url}
                  alt={release.title}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-8 h-8 text-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{release.title}</p>
                <p className="text-xs text-secondary-500 mb-2">
                  {release.track_count} track{release.track_count > 1 ? 's' : ''} • {formatNumber(release.streams)} streams
                </p>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-secondary-500">Net</p>
                    <p className="font-semibold text-success">{formatCurrency(release.net, release.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-secondary-500">Gross</p>
                    <p className="text-sm text-foreground">{formatCurrency(release.gross, release.currency)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>

      <BottomNav />
    </div>
  );
}
