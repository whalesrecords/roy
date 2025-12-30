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
import { Artist } from '@/lib/types';
import { getArtists, getCatalogArtists, CatalogArtist, createArtist } from '@/lib/api';

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [catalogArtists, setCatalogArtists] = useState<CatalogArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    loadArtists();
  }, []);

  const loadArtists = async () => {
    try {
      const data = await getArtists();
      setArtists(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
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

  // Filter artists by search
  const filteredArtists = artists.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                            <p className="font-medium text-foreground">{artist.name}</p>
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
