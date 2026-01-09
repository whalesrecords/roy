'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Spinner } from '@heroui/react';
import { Artist, ArtistCategory } from '@/lib/types';
import { getArtists, getCatalogArtists, CatalogArtist, createArtist, getDuplicateArtists, mergeArtists, SimilarArtistGroup } from '@/lib/api';

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [catalogArtists, setCatalogArtists] = useState<CatalogArtist[]>([]);
  const [duplicates, setDuplicates] = useState<SimilarArtistGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [mergingPair, setMergingPair] = useState<{ source: Artist; target: Artist } | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activating, setActivating] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ArtistCategory | 'all'>('all');

  useEffect(() => {
    loadArtists();
  }, []);

  const loadArtists = async () => {
    try {
      const [artistsData, duplicatesData] = await Promise.all([
        getArtists(),
        getDuplicateArtists()
      ]);
      setArtists(artistsData);
      setDuplicates(duplicatesData);
      if (duplicatesData.length > 0) {
        setShowDuplicates(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!mergingPair) return;
    setMerging(true);
    setError(null);
    try {
      await mergeArtists(mergingPair.source.id, mergingPair.target.id);
      setMergingPair(null);
      setDuplicates([]);
      await loadArtists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la fusion');
      setMergingPair(null);
      await loadArtists();
    } finally {
      setMerging(false);
    }
  };

  const loadCatalog = async () => {
    if (catalogArtists.length > 0) {
      setShowCatalog(true);
      return;
    }
    setLoadingCatalog(true);
    try {
      const data = await getCatalogArtists();
      setCatalogArtists(data);
      setShowCatalog(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement du catalogue');
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleActivate = async (artistName: string) => {
    setActivating(artistName);
    try {
      await createArtist(artistName);
      await loadArtists();
      setCatalogArtists(prev => prev.filter(ca => ca.artist_name !== artistName));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'activation');
    } finally {
      setActivating(null);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('fr-FR', { style: 'currency', currency });
  };

  const filteredArtists = artists.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const signedCount = artists.filter(a => a.category === 'signed').length;
  const collaboratorCount = artists.filter(a => a.category === 'collaborator').length;

  const inactiveCatalog = catalogArtists.filter(ca =>
    !artists.some(a => a.name.toLowerCase() === ca.artist_name.toLowerCase())
  ).filter(ca =>
    ca.artist_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ArtistAvatar = ({ artist, name }: { artist?: Artist; name: string }) => {
    const imageUrl = artist?.image_url_small || artist?.image_url;
    if (imageUrl) {
      return (
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-default-100 flex-shrink-0 shadow-sm">
          <Image src={imageUrl} alt={name} width={48} height={48} className="w-full h-full object-cover" />
        </div>
      );
    }
    return (
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
        {name.charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-background border-b border-divider sticky top-16 z-30">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Artistes</h1>
              <p className="text-secondary-500 text-sm mt-1">Gerez vos artistes et collaborateurs</p>
            </div>
            {!showCatalog && (
              <button
                onClick={loadCatalog}
                disabled={loadingCatalog}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all duration-200 text-sm font-medium"
              >
                {loadingCatalog ? (
                  <Spinner size="sm" color="primary" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                )}
                Voir le catalogue
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher un artiste..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-12 pr-4 rounded-xl border-2 border-default-200 bg-content2 text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 mt-4">
            {[
              { key: 'all', label: `Tous (${artists.length})` },
              { key: 'signed', label: `Signes (${signedCount})` },
              { key: 'collaborator', label: `Collabs (${collaboratorCount})` },
            ].map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategoryFilter(cat.key as ArtistCategory | 'all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  categoryFilter === cat.key
                    ? 'bg-primary text-white shadow-md shadow-primary/30'
                    : 'bg-default-100 text-secondary-600 hover:bg-default-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-danger flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Duplicates Warning */}
        {duplicates.length > 0 && showDuplicates && (
          <div className="bg-warning-50 border border-warning-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-warning-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-warning-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-warning-800">Doublons detectes</h2>
                  <p className="text-sm text-warning-600">{duplicates.length} groupe(s) a verifier</p>
                </div>
              </div>
              <button
                onClick={() => setShowDuplicates(false)}
                className="text-warning-600 hover:text-warning-800 p-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="divide-y divide-warning-200">
              {duplicates.map((group, idx) => (
                <div key={idx} className="p-5">
                  <p className="text-sm text-warning-700 mb-3">Ces artistes ont des noms similaires :</p>
                  <div className="space-y-2">
                    {group.artists.map((artist) => (
                      <div key={artist.id} className="flex items-center justify-between bg-background rounded-xl p-3">
                        <div className="flex items-center gap-3">
                          <ArtistAvatar artist={artist} name={artist.name} />
                          <div>
                            <p className="font-medium text-foreground">{artist.name}</p>
                            <p className="text-xs text-secondary-500">{artist.spotify_id ? 'Spotify lie' : 'Pas de Spotify'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {group.artists.filter(a => a.id !== artist.id).map((other) => (
                            <button
                              key={other.id}
                              onClick={() => setMergingPair({ source: other, target: artist })}
                              className="px-3 py-1.5 rounded-lg bg-warning-100 text-warning-700 hover:bg-warning-200 text-xs font-medium transition-colors"
                            >
                              Fusionner ici
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Merge Confirmation */}
        {mergingPair && (
          <div className="bg-primary-50 border border-primary-200 rounded-2xl p-5">
            <h3 className="font-semibold text-primary-800 mb-3">Confirmer la fusion</h3>
            <p className="text-sm text-primary-700 mb-4">
              Fusionner <strong>&quot;{mergingPair.source.name}&quot;</strong> vers <strong>&quot;{mergingPair.target.name}&quot;</strong>
            </p>
            <div className="bg-background rounded-xl p-4 text-sm space-y-2 mb-4">
              <p className="text-secondary-600">• Toutes les transactions seront transferees</p>
              <p className="text-secondary-600">• Les avances et contrats seront fusionnes</p>
              <p className="text-secondary-600">• L&apos;artiste source sera supprime</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setMergingPair(null)}
                disabled={merging}
                className="px-4 py-2 rounded-xl text-sm font-medium text-secondary-600 hover:bg-default-100 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleMerge}
                disabled={merging}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-500 transition-colors flex items-center gap-2"
              >
                {merging && <Spinner size="sm" color="white" />}
                Confirmer
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <Spinner size="lg" color="primary" />
            <p className="text-secondary-500 mt-4">Chargement des artistes...</p>
          </div>
        ) : (
          <>
            {/* Active Artists */}
            <div className="bg-background rounded-2xl border border-divider shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-divider flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-success"></div>
                <h2 className="font-semibold text-foreground">Artistes actifs</h2>
                <span className="text-sm text-secondary-500">({filteredArtists.length})</span>
              </div>
              {filteredArtists.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-default-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-secondary-500">{searchQuery ? 'Aucun artiste trouve' : 'Aucun artiste active'}</p>
                  {!showCatalog && !searchQuery && (
                    <button
                      onClick={loadCatalog}
                      className="mt-4 px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-sm font-medium"
                    >
                      Activer depuis le catalogue
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-divider">
                  {filteredArtists.map((artist) => (
                    <Link
                      key={artist.id}
                      href={`/artists/${artist.id}`}
                      className="flex items-center justify-between p-4 hover:bg-content2 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <ArtistAvatar artist={artist} name={artist.name} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground group-hover:text-primary transition-colors">{artist.name}</p>
                            {artist.category === 'collaborator' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-600">Collab</span>
                            )}
                          </div>
                          <p className="text-sm text-secondary-500">{artist.spotify_id ? 'Spotify lie' : 'Configurer →'}</p>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-secondary-400 group-hover:text-primary group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Catalog */}
            {showCatalog && (
              <div className="bg-background rounded-2xl border border-divider shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-warning"></div>
                    <h2 className="font-semibold text-foreground">A activer</h2>
                    <span className="text-sm text-secondary-500">({inactiveCatalog.length})</span>
                  </div>
                  <button
                    onClick={() => setShowCatalog(false)}
                    className="text-secondary-500 hover:text-secondary-700 p-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {loadingCatalog ? (
                  <div className="p-12 text-center">
                    <Spinner size="md" color="primary" />
                    <p className="text-secondary-500 mt-3">Chargement du catalogue...</p>
                  </div>
                ) : inactiveCatalog.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-secondary-500">{searchQuery ? 'Aucun artiste trouve' : 'Tous les artistes sont actives'}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-divider max-h-96 overflow-y-auto">
                    {inactiveCatalog.slice(0, 50).map((ca) => (
                      <div key={ca.artist_name} className="flex items-center justify-between p-4 hover:bg-content2 transition-colors">
                        <div className="flex items-center gap-4">
                          <ArtistAvatar name={ca.artist_name} />
                          <div>
                            <p className="font-medium text-foreground">{ca.artist_name}</p>
                            <p className="text-sm text-secondary-500">{ca.release_count} releases · {formatCurrency(ca.total_gross, ca.currency)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleActivate(ca.artist_name)}
                          disabled={!!activating}
                          className="px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-sm font-medium flex items-center gap-2"
                        >
                          {activating === ca.artist_name && <Spinner size="sm" color="primary" />}
                          Activer
                        </button>
                      </div>
                    ))}
                    {inactiveCatalog.length > 50 && (
                      <div className="p-4 text-center text-secondary-500 text-sm">
                        +{inactiveCatalog.length - 50} autres artistes
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
