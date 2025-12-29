'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Artist } from '@/lib/types';
import { getArtists, createArtist, getCatalogArtists, CatalogArtist, getArtistReleases, CatalogRelease } from '@/lib/api';

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [catalogArtists, setCatalogArtists] = useState<CatalogArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Activate modal
  const [showActivate, setShowActivate] = useState(false);
  const [selectedCatalogArtist, setSelectedCatalogArtist] = useState<CatalogArtist | null>(null);
  const [releases, setReleases] = useState<CatalogRelease[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [artistsData, catalogData] = await Promise.all([
        getArtists(),
        getCatalogArtists(),
      ]);
      setArtists(artistsData);
      setCatalogArtists(catalogData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const isArtistActive = (catalogArtist: CatalogArtist) => {
    return artists.some(a => a.name.toLowerCase() === catalogArtist.artist_name.toLowerCase());
  };

  const getArtistId = (catalogArtist: CatalogArtist) => {
    const artist = artists.find(a => a.name.toLowerCase() === catalogArtist.artist_name.toLowerCase());
    return artist?.id;
  };

  const handleOpenActivate = async (catalogArtist: CatalogArtist) => {
    setSelectedCatalogArtist(catalogArtist);
    setShowActivate(true);
    setLoadingReleases(true);

    try {
      const releasesData = await getArtistReleases(catalogArtist.artist_name);
      setReleases(releasesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement des releases');
    } finally {
      setLoadingReleases(false);
    }
  };

  const handleActivate = async () => {
    if (!selectedCatalogArtist) return;
    setActivating(true);
    setError(null);

    try {
      await createArtist(selectedCatalogArtist.artist_name);
      setShowActivate(false);
      setSelectedCatalogArtist(null);
      setReleases([]);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'activation');
    } finally {
      setActivating(false);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('fr-FR', { style: 'currency', currency });
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('fr-FR');
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-neutral-900">Artistes</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Activez les artistes puis définissez les contrats par release ou track
          </p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 text-red-600 rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-neutral-500">Chargement...</p>
          </div>
        ) : catalogArtists.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucun artiste</h3>
            <p className="text-neutral-500 mb-4">Importez des données TuneCore pour voir les artistes</p>
            <Link href="/imports">
              <Button>Aller aux imports</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {catalogArtists.map((catalogArtist) => {
              const active = isArtistActive(catalogArtist);
              const artistId = getArtistId(catalogArtist);

              return (
                <div
                  key={catalogArtist.artist_name}
                  className="bg-white rounded-xl border border-neutral-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-neutral-900 truncate">
                          {catalogArtist.artist_name}
                        </p>
                        {active && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Actif
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-500 mt-1">
                        {catalogArtist.release_count} release{catalogArtist.release_count > 1 ? 's' : ''} · {catalogArtist.track_count} track{catalogArtist.track_count > 1 ? 's' : ''}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {formatCurrency(catalogArtist.total_gross, catalogArtist.currency)} · {formatNumber(catalogArtist.total_streams)} streams
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {active && artistId ? (
                        <Link href={`/artists/${artistId}`}>
                          <Button size="sm" variant="secondary">Contrats</Button>
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleOpenActivate(catalogArtist)}
                        >
                          Activer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Activate Modal - Shows releases */}
      {showActivate && selectedCatalogArtist && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-4 py-4 sm:px-6 border-b border-neutral-100 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900">Activer {selectedCatalogArtist.artist_name}</h2>
                <button
                  onClick={() => {
                    setShowActivate(false);
                    setReleases([]);
                  }}
                  className="p-2 -mr-2 text-neutral-500 hover:text-neutral-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  Activez l'artiste, puis définissez les % par release ou track sur la page suivante.
                </p>
              </div>

              {loadingReleases ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">Chargement des releases...</p>
                </div>
              ) : (
                <div>
                  <h3 className="font-medium text-neutral-900 mb-2">
                    Releases ({releases.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {releases.map((release, index) => (
                      <div
                        key={`${release.upc}-${index}`}
                        className="bg-neutral-50 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-neutral-900 text-sm truncate">
                              {release.release_title}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {release.track_count} track{release.track_count > 1 ? 's' : ''} · {formatCurrency(release.total_gross, release.currency)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-neutral-100 p-4 sm:p-6 flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowActivate(false);
                  setReleases([]);
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={handleActivate}
                loading={activating}
                className="flex-1"
              >
                Activer et configurer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
