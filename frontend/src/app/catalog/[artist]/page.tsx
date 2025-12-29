'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getArtistReleases, getArtistTracks, CatalogRelease, CatalogTrack } from '@/lib/api';

type Tab = 'releases' | 'tracks';

export default function CatalogArtistPage() {
  const params = useParams();
  const artistName = decodeURIComponent(params.artist as string);

  const [tab, setTab] = useState<Tab>('releases');
  const [releases, setReleases] = useState<CatalogRelease[]>([]);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [artistName]);

  const loadData = async () => {
    try {
      const [releasesData, tracksData] = await Promise.all([
        getArtistReleases(artistName),
        getArtistTracks(artistName),
      ]);
      setReleases(releasesData);
      setTracks(tracksData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string) => {
    return parseFloat(value).toLocaleString('fr-FR', { style: 'currency', currency: 'USD' });
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('fr-FR');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Link href="/catalog" className="text-sm text-neutral-500 hover:text-neutral-700 mb-2 inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Catalogue
          </Link>
          <h1 className="text-xl font-semibold text-neutral-900">{artistName}</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {releases.length} release{releases.length > 1 ? 's' : ''} · {tracks.length} track{tracks.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setTab('releases')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'releases'
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Releases ({releases.length})
            </button>
            <button
              onClick={() => setTab('tracks')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'tracks'
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Tracks ({tracks.length})
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <p className="text-red-600 mb-4">{error}</p>
        )}

        {tab === 'releases' && (
          <div className="space-y-2">
            {releases.map((release, index) => (
              <div
                key={`${release.upc}-${index}`}
                className="bg-white rounded-xl border border-neutral-200 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900">{release.release_title}</p>
                    {release.upc && (
                      <p className="text-xs text-neutral-400 mt-0.5 font-mono">UPC: {release.upc}</p>
                    )}
                    <p className="text-sm text-neutral-500 mt-1">
                      {release.track_count} track{release.track_count > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-medium text-neutral-900">{formatCurrency(release.total_gross)}</p>
                    <p className="text-sm text-neutral-500">{formatNumber(release.total_streams)} streams</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'tracks' && (
          <div className="space-y-2">
            {tracks.map((track, index) => (
              <div
                key={`${track.isrc}-${index}`}
                className="bg-white rounded-xl border border-neutral-200 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900">{track.track_title}</p>
                    {track.release_title && (
                      <p className="text-sm text-neutral-500">{track.release_title}</p>
                    )}
                    {track.isrc && (
                      <p className="text-xs text-neutral-400 mt-0.5 font-mono">ISRC: {track.isrc}</p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-medium text-neutral-900">{formatCurrency(track.total_gross)}</p>
                    <p className="text-sm text-neutral-500">{formatNumber(track.total_streams)} streams</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
