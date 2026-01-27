'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/layout/BottomNav';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getArtistTracks, ArtistTrack } from '@/lib/api';
import BottomNav from '@/components/layout/BottomNav';

export default function TracksPage() {
  const { artist, loading: authLoading } = useAuth();
  const [tracks, setTracks] = useState<ArtistTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            <p className="text-xs text-secondary-500">{tracks.length} track{tracks.length > 1 ? 's' : ''}</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-24 space-y-2">
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl mb-4">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

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

        {tracks.map((track, index) => (
          <div
            key={`${track.isrc}-${index}`}
            className="bg-background border border-divider rounded-xl p-3 flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate text-sm">{track.title}</p>
              {track.release_title && (
                <p className="text-xs text-secondary-500 truncate">{track.release_title}</p>
              )}
              <p className="text-xs text-secondary-400">{formatNumber(track.streams)} streams</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-success text-sm">{formatCurrency(track.net, track.currency)}</p>
              <p className="text-xs text-secondary-500">{formatCurrency(track.gross, track.currency)}</p>
            </div>
          </div>
        ))}
      </main>

      <BottomNav />
    </div>
  );
}
