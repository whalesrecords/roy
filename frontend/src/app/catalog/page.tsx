'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCatalogArtists, CatalogArtist } from '@/lib/api';

export default function CatalogPage() {
  const [artists, setArtists] = useState<CatalogArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadArtists();
  }, []);

  const loadArtists = async () => {
    try {
      const data = await getCatalogArtists();
      setArtists(data);
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

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-neutral-900">Catalogue</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Artistes extraits des imports TuneCore
          </p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-neutral-500">Chargement...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error}</p>
          </div>
        ) : artists.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucun artiste</h3>
            <p className="text-neutral-500">Importez des données TuneCore pour voir le catalogue</p>
          </div>
        ) : (
          <div className="space-y-2">
            {artists.map((artist) => (
              <Link
                key={artist.artist_name}
                href={`/catalog/${encodeURIComponent(artist.artist_name)}`}
                className="block bg-white rounded-xl border border-neutral-200 p-4 hover:border-neutral-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900 truncate">{artist.artist_name}</p>
                    <p className="text-sm text-neutral-500 mt-1">
                      {artist.release_count} release{artist.release_count > 1 ? 's' : ''} · {artist.track_count} track{artist.track_count > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-medium text-neutral-900">{formatCurrency(artist.total_gross)}</p>
                    <p className="text-sm text-neutral-500">{formatNumber(artist.total_streams)} streams</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
