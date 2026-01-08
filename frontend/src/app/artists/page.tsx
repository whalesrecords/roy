'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Spinner,
  Input,
} from '@heroui/react';
import { Artist, ArtistCategory, ARTIST_CATEGORIES } from '@/lib/types';
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
      // Force refresh
      setDuplicates([]);
      await loadArtists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la fusion');
      setMergingPair(null);
      // Refresh to get current state
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
      // Remove from catalog view
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

  // Filter artists by search and category
  const filteredArtists = artists.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Count by category
  const signedCount = artists.filter(a => a.category === 'signed').length;
  const collaboratorCount = artists.filter(a => a.category === 'collaborator').length;

  // Inactive catalog artists (not yet activated)
  const inactiveCatalog = catalogArtists.filter(ca =>
    !artists.some(a => a.name.toLowerCase() === ca.artist_name.toLowerCase())
  ).filter(ca =>
    ca.artist_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Artist avatar
  const ArtistAvatar = ({ artist, name }: { artist?: Artist; name: string }) => {
    const imageUrl = artist?.image_url_small || artist?.image_url;
    if (imageUrl) {
      return (
        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-default-100 flex-shrink-0">
          <Image src={imageUrl} alt={name} width={48} height={48} className="w-full h-full object-cover" />
        </div>
      );
    }
    return (
      <div className="w-12 h-12 rounded-2xl bg-default-200 flex items-center justify-center text-default-500 font-medium flex-shrink-0">
        {name.charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <>
      <header className="bg-background border-b border-divider sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold text-foreground">Artistes</h1>
            {!showCatalog && (
              <Button
                size="sm"
                variant="bordered"
                onPress={loadCatalog}
                isLoading={loadingCatalog}
              >
                Voir le catalogue
              </Button>
            )}
          </div>
          <Input
            placeholder="Rechercher un artiste..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            startContent={
              <svg className="w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            classNames={{
              inputWrapper: "bg-default-100",
            }}
          />
          {/* Category Filter Tabs */}
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant={categoryFilter === 'all' ? 'solid' : 'flat'}
              color={categoryFilter === 'all' ? 'primary' : 'default'}
              onPress={() => setCategoryFilter('all')}
            >
              Tous ({artists.length})
            </Button>
            <Button
              size="sm"
              variant={categoryFilter === 'signed' ? 'solid' : 'flat'}
              color={categoryFilter === 'signed' ? 'primary' : 'default'}
              onPress={() => setCategoryFilter('signed')}
            >
              Signés ({signedCount})
            </Button>
            <Button
              size="sm"
              variant={categoryFilter === 'collaborator' ? 'solid' : 'flat'}
              color={categoryFilter === 'collaborator' ? 'secondary' : 'default'}
              onPress={() => setCategoryFilter('collaborator')}
            >
              Collaborateurs ({collaboratorCount})
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <Card className="bg-danger-50">
            <CardBody>
              <p className="text-danger">{error}</p>
            </CardBody>
          </Card>
        )}

        {/* Duplicates Warning */}
        {duplicates.length > 0 && showDuplicates && (
          <Card className="border-2 border-warning bg-warning-50">
            <CardHeader className="px-4 py-3 border-b border-warning-200">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h2 className="font-semibold text-warning-800">Doublons détectés</h2>
                  <span className="text-sm text-warning-600">({duplicates.length} groupes)</span>
                </div>
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => setShowDuplicates(false)}
                >
                  Masquer
                </Button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-warning-200">
                {duplicates.map((group, idx) => (
                  <div key={idx} className="p-4">
                    <p className="text-sm text-warning-700 mb-3">
                      Ces artistes ont des noms similaires. Voulez-vous les fusionner ?
                    </p>
                    <div className="space-y-2">
                      {group.artists.map((artist) => (
                        <div
                          key={artist.id}
                          className="flex items-center justify-between bg-white rounded-lg p-3"
                        >
                          <div className="flex items-center gap-3">
                            <ArtistAvatar artist={artist} name={artist.name} />
                            <div>
                              <p className="font-medium text-foreground">{artist.name}</p>
                              <p className="text-xs text-default-500">
                                {artist.spotify_id ? 'Spotify lié' : 'Pas de Spotify'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {group.artists.filter(a => a.id !== artist.id).map((other) => (
                              <Button
                                key={other.id}
                                size="sm"
                                color="warning"
                                variant="flat"
                                onPress={() => setMergingPair({ source: other, target: artist })}
                              >
                                Fusionner &quot;{other.name}&quot; ici
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {/* Merge Confirmation Modal */}
        {mergingPair && (
          <Card className="border-2 border-primary bg-primary-50">
            <CardHeader className="px-4 py-3 border-b border-primary-200">
              <h2 className="font-semibold text-primary-800">Confirmer la fusion</h2>
            </CardHeader>
            <CardBody className="p-4 space-y-4">
              <p className="text-sm text-primary-700">
                Vous allez fusionner <strong>&quot;{mergingPair.source.name}&quot;</strong> vers <strong>&quot;{mergingPair.target.name}&quot;</strong>.
              </p>
              <div className="bg-white rounded-lg p-3 text-sm space-y-1">
                <p>• Toutes les transactions seront transférées vers <strong>{mergingPair.target.name}</strong></p>
                <p>• Les avances et contrats seront fusionnés</p>
                <p>• L&apos;artiste <strong>{mergingPair.source.name}</strong> sera supprimé</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => setMergingPair(null)}
                  isDisabled={merging}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  color="primary"
                  onPress={handleMerge}
                  isLoading={merging}
                >
                  Confirmer la fusion
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12">
            <Spinner size="lg" color="primary" />
            <p className="text-default-500 mt-3">Chargement...</p>
          </div>
        ) : (
          <>
            {/* Active Artists */}
            <Card className="border border-divider">
              <CardHeader className="px-4 py-3 border-b border-divider">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success"></div>
                  <h2 className="font-semibold text-foreground">Artistes actifs</h2>
                  <span className="text-sm text-default-500">({filteredArtists.length})</span>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {filteredArtists.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-default-500">
                      {searchQuery ? 'Aucun artiste trouvé' : 'Aucun artiste activé'}
                    </p>
                    {!showCatalog && !searchQuery && (
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        className="mt-3"
                        onPress={loadCatalog}
                        isLoading={loadingCatalog}
                      >
                        Activer depuis le catalogue
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-divider">
                    {filteredArtists.map((artist) => (
                      <Link
                        key={artist.id}
                        href={`/artists/${artist.id}`}
                        className="flex items-center justify-between p-4 hover:bg-default-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <ArtistAvatar artist={artist} name={artist.name} />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{artist.name}</p>
                              {artist.category === 'collaborator' && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-secondary-100 text-secondary-700">
                                  Collab
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-default-500">
                              {artist.spotify_id ? 'Spotify lié' : 'Configurer →'}
                            </p>
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Catalog (lazy loaded) */}
            {showCatalog && (
              <Card className="border border-divider">
                <CardHeader className="px-4 py-3 border-b border-divider">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-warning"></div>
                      <h2 className="font-semibold text-foreground">À activer</h2>
                      <span className="text-sm text-default-500">({inactiveCatalog.length})</span>
                    </div>
                    <Button
                      size="sm"
                      variant="light"
                      onPress={() => setShowCatalog(false)}
                    >
                      Masquer
                    </Button>
                  </div>
                </CardHeader>
                <CardBody className="p-0">
                  {loadingCatalog ? (
                    <div className="p-8 text-center">
                      <Spinner size="md" />
                      <p className="text-default-500 mt-2">Chargement du catalogue...</p>
                    </div>
                  ) : inactiveCatalog.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-default-500">
                        {searchQuery ? 'Aucun artiste trouvé' : 'Tous les artistes sont activés'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-divider max-h-96 overflow-y-auto">
                      {inactiveCatalog.slice(0, 50).map((ca) => (
                        <div
                          key={ca.artist_name}
                          className="flex items-center justify-between p-4 hover:bg-default-50"
                        >
                          <div className="flex items-center gap-3">
                            <ArtistAvatar name={ca.artist_name} />
                            <div>
                              <p className="font-medium text-foreground">{ca.artist_name}</p>
                              <p className="text-sm text-default-500">
                                {ca.release_count} releases · {formatCurrency(ca.total_gross, ca.currency)}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            onPress={() => handleActivate(ca.artist_name)}
                            isLoading={activating === ca.artist_name}
                            isDisabled={!!activating}
                          >
                            Activer
                          </Button>
                        </div>
                      ))}
                      {inactiveCatalog.length > 50 && (
                        <div className="p-4 text-center text-default-500 text-sm">
                          +{inactiveCatalog.length - 50} autres artistes (utilisez la recherche)
                        </div>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
