'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider,
  Tooltip,
} from '@heroui/react';
import { Artist } from '@/lib/types';
import { getArtists, createArtist, getCatalogArtists, CatalogArtist, getArtistReleases, CatalogRelease, getCollaborationSuggestions, CollaborationSuggestion } from '@/lib/api';

// Patterns to detect collaboration artist names
const COLLAB_PATTERNS = [
  /\s+&\s+/i,
  /\s+feat\.?\s+/i,
  /\s+ft\.?\s+/i,
  /\s+x\s+/i,
  /\s+vs\.?\s+/i,
  /,\s+/,
];

function isCollaboration(artistName: string): boolean {
  return COLLAB_PATTERNS.some(pattern => pattern.test(artistName));
}

function splitCollabArtists(artistName: string): string[] {
  let parts = [artistName];
  for (const pattern of COLLAB_PATTERNS) {
    parts = parts.flatMap(part => part.split(pattern).map(s => s.trim()).filter(Boolean));
  }
  return Array.from(new Set(parts));
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [catalogArtists, setCatalogArtists] = useState<CatalogArtist[]>([]);
  const [collabSuggestions, setCollabSuggestions] = useState<CollaborationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Activate modal
  const [showActivate, setShowActivate] = useState(false);
  const [selectedCatalogArtist, setSelectedCatalogArtist] = useState<CatalogArtist | null>(null);
  const [releases, setReleases] = useState<CatalogRelease[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [activating, setActivating] = useState(false);

  // Create collab artist
  const [creatingCollabArtist, setCreatingCollabArtist] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [artistsData, catalogData, suggestionsData] = await Promise.all([
        getArtists(),
        getCatalogArtists(),
        getCollaborationSuggestions(100),
      ]);
      setArtists(artistsData);
      setCatalogArtists(catalogData);
      setCollabSuggestions(suggestionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const getActiveArtist = (catalogArtist: CatalogArtist): Artist | undefined => {
    return artists.find(a => a.name.toLowerCase() === catalogArtist.artist_name.toLowerCase());
  };

  const isArtistActive = (catalogArtist: CatalogArtist) => {
    return !!getActiveArtist(catalogArtist);
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

  const handleCreateCollabArtist = async (artistName: string) => {
    setCreatingCollabArtist(artistName);
    setError(null);
    try {
      await createArtist(artistName);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setCreatingCollabArtist(null);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('fr-FR', { style: 'currency', currency });
  };

  const formatNumber = (value: number | null | undefined) => {
    return (value ?? 0).toLocaleString('fr-FR');
  };

  // Separate collaborations, active, and inactive artists
  const allCollabArtists = catalogArtists.filter(ca => isCollaboration(ca.artist_name));
  // Only show collabs that still need configuration (have tracks in suggestions)
  const collabArtists = allCollabArtists.filter(ca =>
    collabSuggestions.some(s => s.original_artist_name === ca.artist_name)
  );
  const soloArtists = catalogArtists.filter(ca => !isCollaboration(ca.artist_name));
  const activeArtists = soloArtists.filter(ca => isArtistActive(ca));
  const inactiveArtists = soloArtists.filter(ca => !isArtistActive(ca));

  // Extract individual artists from all collaborations (not just unconfigured ones)
  const collabIndividuals = (() => {
    const individualsMap = new Map<string, { name: string; fromCollabs: string[]; isActive: boolean }>();

    for (const collab of allCollabArtists) {
      const names = splitCollabArtists(collab.artist_name);
      for (const name of names) {
        const key = name.toLowerCase();
        // Skip if this artist already exists as a solo artist in catalog
        if (soloArtists.some(sa => sa.artist_name.toLowerCase() === key)) continue;

        const existing = individualsMap.get(key);
        if (existing) {
          existing.fromCollabs.push(collab.artist_name);
        } else {
          const isActive = artists.some(a => a.name.toLowerCase() === key);
          individualsMap.set(key, { name, fromCollabs: [collab.artist_name], isActive });
        }
      }
    }

    return Array.from(individualsMap.values()).sort((a, b) => {
      // Active first, then alphabetically
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  })();

  // Artist avatar component
  const ArtistAvatar = ({ artist, name, size = 'md' }: { artist?: Artist; name: string; size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
      sm: 'w-10 h-10 text-sm',
      md: 'w-12 h-12 text-lg',
      lg: 'w-16 h-16 text-xl',
    };

    const imageUrl = artist?.image_url_small || artist?.image_url;

    if (imageUrl) {
      return (
        <div className={`${sizeClasses[size]} rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0`}>
          <Image
            src={imageUrl}
            alt={name}
            width={64}
            height={64}
            className="w-full h-full object-cover"
          />
        </div>
      );
    }

    return (
      <div className={`${sizeClasses[size]} rounded-2xl bg-gray-200 flex items-center justify-center text-gray-500 font-medium flex-shrink-0`}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold text-gray-900">Artistes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Activez les artistes puis définissez les contrats par release ou track
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <Card className="border border-red-200 bg-red-50">
            <CardBody>
              <p className="text-red-700">{error}</p>
            </CardBody>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-16">
            <Spinner size="lg" />
            <p className="text-gray-500 mt-4">Chargement...</p>
          </div>
        ) : catalogArtists.length === 0 ? (
          <Card className="border border-gray-200">
            <CardBody className="py-16">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun artiste</h3>
                <p className="text-gray-500 mb-6">Importez des données TuneCore pour voir les artistes</p>
                <Link href="/imports">
                  <Button variant="bordered">
                    Aller aux imports
                  </Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="border border-gray-200">
                <CardBody className="p-4 text-center">
                  <p className="text-3xl font-bold text-gray-900">{soloArtists.length}</p>
                  <p className="text-sm text-gray-500">Dans catalogue</p>
                </CardBody>
              </Card>
              <Card className="border border-gray-200">
                <CardBody className="p-4 text-center">
                  <p className="text-3xl font-bold text-gray-900">{activeArtists.length}</p>
                  <p className="text-sm text-gray-500">Actifs</p>
                </CardBody>
              </Card>
              <Card className="border border-gray-200">
                <CardBody className="p-4 text-center">
                  <p className="text-3xl font-bold text-gray-900">{inactiveArtists.length}</p>
                  <p className="text-sm text-gray-500">En attente</p>
                </CardBody>
              </Card>
              <Card className="border border-gray-200 border-amber-200 bg-amber-50">
                <CardBody className="p-4 text-center">
                  <p className="text-3xl font-bold text-amber-600">{collabArtists.length}</p>
                  <p className="text-sm text-amber-700">Collabs</p>
                </CardBody>
              </Card>
            </div>

            {/* Active Artists Section */}
            {activeArtists.length > 0 && (
              <Card className="border border-gray-200">
                <CardHeader className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">Artistes actifs</h2>
                    <span className="text-sm text-gray-500">({activeArtists.length})</span>
                  </div>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="divide-y divide-gray-100">
                    {activeArtists.map((catalogArtist) => {
                      const activeArtist = getActiveArtist(catalogArtist);
                      return (
                        <div key={catalogArtist.artist_name} className="p-5 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <ArtistAvatar artist={activeArtist} name={catalogArtist.artist_name} />
                              <div>
                                <p className="font-semibold text-gray-900">{catalogArtist.artist_name}</p>
                                <p className="text-sm text-gray-500">
                                  {catalogArtist.release_count} releases · {catalogArtist.track_count} tracks
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-semibold text-gray-900">{formatCurrency(catalogArtist.total_gross, catalogArtist.currency)}</p>
                                <p className="text-sm text-gray-500">{formatNumber(catalogArtist.total_streams)} streams</p>
                              </div>
                              {activeArtist && (
                                <Link href={`/artists/${activeArtist.id}`}>
                                  <Button size="sm" variant="bordered">
                                    Contrats
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Inactive Artists Section */}
            {inactiveArtists.length > 0 && (
              <Card className="border border-gray-200">
                <CardHeader className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">En attente d'activation</h2>
                    <span className="text-sm text-gray-500">({inactiveArtists.length})</span>
                  </div>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="divide-y divide-gray-100">
                    {inactiveArtists.map((catalogArtist) => (
                      <div key={catalogArtist.artist_name} className="p-5 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <ArtistAvatar name={catalogArtist.artist_name} />
                            <div>
                              <p className="font-semibold text-gray-900">{catalogArtist.artist_name}</p>
                              <p className="text-sm text-gray-500">
                                {catalogArtist.release_count} releases · {catalogArtist.track_count} tracks
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">{formatCurrency(catalogArtist.total_gross, catalogArtist.currency)}</p>
                              <p className="text-sm text-gray-500">{formatNumber(catalogArtist.total_streams)} streams</p>
                            </div>
                            <Button
                              size="sm"
                              variant="bordered"
                              onPress={() => handleOpenActivate(catalogArtist)}
                            >
                              Activer
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Individual Artists from Collaborations */}
            {collabIndividuals.length > 0 && (
              <Card className="border border-blue-200 bg-blue-50/50">
                <CardHeader className="px-6 py-4 border-b border-blue-200">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h2 className="text-lg font-semibold text-blue-800">Artistes des collaborations</h2>
                    <span className="text-sm text-blue-600">({collabIndividuals.length})</span>
                  </div>
                </CardHeader>
                <CardBody className="p-4">
                  <p className="text-sm text-blue-700 mb-4">
                    Ces artistes apparaissent dans des collaborations mais pas en solo. Créez-les pour pouvoir configurer leurs contrats individuels.
                  </p>
                  <div className="space-y-2">
                    {collabIndividuals.map((individual) => {
                      const activeArtist = artists.find(a => a.name.toLowerCase() === individual.name.toLowerCase());
                      return (
                        <div
                          key={individual.name}
                          className={`flex items-center justify-between p-3 rounded-xl ${
                            individual.isActive
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-white border border-blue-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <ArtistAvatar artist={activeArtist} name={individual.name} size="sm" />
                            <div>
                              <p className={`font-medium ${individual.isActive ? 'text-green-700' : 'text-gray-900'}`}>
                                {individual.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {individual.fromCollabs.length === 1
                                  ? `Dans "${individual.fromCollabs[0]}"`
                                  : `Dans ${individual.fromCollabs.length} collaborations`}
                              </p>
                            </div>
                          </div>
                          {individual.isActive ? (
                            <Link href={`/artists/${activeArtist?.id}`}>
                              <Button size="sm" variant="bordered" className="border-green-300 text-green-700">
                                Contrats
                              </Button>
                            </Link>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-blue-600 text-white hover:bg-blue-700"
                              onPress={() => handleCreateCollabArtist(individual.name)}
                              isLoading={creatingCollabArtist === individual.name}
                              isDisabled={!!creatingCollabArtist}
                            >
                              Créer
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Collaboration Artists Section */}
            {collabArtists.length > 0 && (
              <Card className="border border-amber-200 bg-amber-50/50">
                <CardHeader className="px-6 py-4 border-b border-amber-200">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <h2 className="text-lg font-semibold text-amber-800">Collaborations</h2>
                      <span className="text-sm text-amber-600">({collabArtists.length})</span>
                    </div>
                    <Link href="/catalog?tab=collabs">
                      <Button size="sm" className="bg-amber-600 text-white hover:bg-amber-700">
                        Configurer les splits
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardBody className="p-4">
                  <p className="text-sm text-amber-700 mb-4">
                    Ces noms correspondent à des collaborations. Configurez les splits dans le Catalogue pour répartir le revenu brut entre les artistes (ex: 50/50). Le contrat de chaque artiste s'applique ensuite (part artiste / part label).
                  </p>
                  <div className="space-y-3">
                    {collabArtists.map((catalogArtist) => {
                      const detectedArtists = splitCollabArtists(catalogArtist.artist_name);
                      const missingArtists = detectedArtists.filter(name =>
                        !artists.some(a => a.name.toLowerCase() === name.toLowerCase())
                      );
                      const allExist = missingArtists.length === 0;

                      return (
                        <div key={catalogArtist.artist_name} className="bg-white rounded-xl p-4 border border-amber-200">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div>
                              <p className="font-semibold text-gray-900">{catalogArtist.artist_name}</p>
                              <p className="text-sm text-gray-500">
                                {formatCurrency(catalogArtist.total_gross, catalogArtist.currency)} · {formatNumber(catalogArtist.total_streams)} streams
                              </p>
                            </div>
                            {allExist ? (
                              <Link href="/catalog?tab=collabs">
                                <Button size="sm" className="bg-green-600 text-white hover:bg-green-700">
                                  Configurer splits
                                </Button>
                              </Link>
                            ) : (
                              <Chip size="sm" className="bg-amber-100 text-amber-700">
                                {missingArtists.length} à créer
                              </Chip>
                            )}
                          </div>

                          <div className="space-y-2">
                            {detectedArtists.map((name) => {
                              const exists = artists.some(a => a.name.toLowerCase() === name.toLowerCase());
                              return (
                                <div
                                  key={name}
                                  className={`flex items-center justify-between p-2 rounded-lg ${
                                    exists
                                      ? 'bg-green-50 border border-green-200'
                                      : 'bg-gray-50 border border-gray-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    {exists ? (
                                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                    )}
                                    <span className={`text-sm font-medium ${exists ? 'text-green-700' : 'text-gray-600'}`}>
                                      {name}
                                    </span>
                                  </div>
                                  {!exists && (
                                    <Button
                                      size="sm"
                                      variant="bordered"
                                      onPress={() => handleCreateCollabArtist(name)}
                                      isLoading={creatingCollabArtist === name}
                                      isDisabled={!!creatingCollabArtist}
                                    >
                                      Créer
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Activate Modal */}
      <Modal
        isOpen={showActivate && !!selectedCatalogArtist}
        onClose={() => {
          setShowActivate(false);
          setReleases([]);
        }}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
                    {selectedCatalogArtist?.artist_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedCatalogArtist?.artist_name}</h3>
                    <p className="text-sm text-gray-500 font-normal">Activer et configurer les contrats</p>
                  </div>
                </div>
              </ModalHeader>
              <ModalBody className="py-5">
                <Card className="border border-gray-200 bg-gray-50">
                  <CardBody className="p-4">
                    <p className="text-sm text-gray-600">
                      Activez l'artiste pour commencer à calculer ses royalties. Vous pourrez ensuite définir les % par release ou track.
                    </p>
                  </CardBody>
                </Card>

                <Divider className="my-4" />

                {loadingReleases ? (
                  <div className="text-center py-8">
                    <Spinner size="md" />
                    <p className="text-sm text-gray-500 mt-3">Chargement des releases...</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">
                      Releases ({releases.length})
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {releases.map((release, index) => (
                        <Card key={`${release.upc}-${index}`} className="border border-gray-200">
                          <CardBody className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-medium">
                                  {release.track_count}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{release.release_title}</p>
                                  <p className="text-xs text-gray-500">
                                    {release.track_count} track{release.track_count > 1 ? 's' : ''}
                                  </p>
                                </div>
                              </div>
                              <p className="font-medium text-gray-900">{formatCurrency(release.total_gross, release.currency)}</p>
                            </div>
                          </CardBody>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter className="border-t border-gray-100">
                <Button variant="bordered" onPress={onClose}>
                  Annuler
                </Button>
                <Button
                  color="primary"
                  onPress={handleActivate}
                  isLoading={activating}
                >
                  Activer
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
