'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardBody,
  Spinner,
} from '@heroui/react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  getCatalogArtists,
  getCatalogTracks,
  getCollaborationSuggestions,
  linkArtistsToTrack,
  getArtists,
  createArtist,
  CatalogArtist,
  CatalogTrackWithLinks,
  CollaborationSuggestion,
  Artist,
} from '@/lib/api';

type Tab = 'artists' | 'tracks' | 'collaborations';

export default function CatalogPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');

  const getInitialTab = (): Tab => {
    if (tabParam === 'tracks') return 'tracks';
    if (tabParam === 'collabs' || tabParam === 'collaborations') return 'collaborations';
    return 'artists';
  };

  const [tab, setTab] = useState<Tab>(getInitialTab());
  const [artists, setArtists] = useState<CatalogArtist[]>([]);
  const [tracks, setTracks] = useState<CatalogTrackWithLinks[]>([]);
  const [suggestions, setSuggestions] = useState<CollaborationSuggestion[]>([]);
  const [managedArtists, setManagedArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLinked, setFilterLinked] = useState<boolean | null>(null);

  // Link modal state
  const [linkingTrack, setLinkingTrack] = useState<CatalogTrackWithLinks | null>(null);
  const [linkShares, setLinkShares] = useState<{ artist_id: string; share_percent: number }[]>([]);
  const [savingLink, setSavingLink] = useState(false);

  // Create artist state
  const [creatingArtist, setCreatingArtist] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Sync tab with URL param
  useEffect(() => {
    if (tabParam === 'tracks') {
      setTab('tracks');
    } else if (tabParam === 'collabs' || tabParam === 'collaborations') {
      setTab('collaborations');
    }
  }, [tabParam]);

  useEffect(() => {
    if (tab === 'tracks') {
      loadTracks();
    } else if (tab === 'collaborations') {
      loadSuggestions();
    }
  }, [tab, searchQuery, filterLinked]);

  const loadData = async () => {
    try {
      const [artistsData, managedData] = await Promise.all([
        getCatalogArtists(),
        getArtists(),
      ]);
      setArtists(artistsData);
      setManagedArtists(managedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const loadTracks = async () => {
    setLoading(true);
    try {
      const data = await getCatalogTracks({
        search: searchQuery || undefined,
        has_links: filterLinked ?? undefined,
        limit: 100,
      });
      setTracks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const data = await getCollaborationSuggestions(50);
      setSuggestions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const openLinkModal = (track: CatalogTrackWithLinks) => {
    setLinkingTrack(track);
    if (track.linked_artists.length > 0) {
      setLinkShares(track.linked_artists.map(l => ({
        artist_id: l.artist_id,
        share_percent: parseFloat(l.share_percent),
      })));
    } else {
      setLinkShares([]);
    }
  };

  const addArtistToLink = (artistId: string) => {
    if (linkShares.some(l => l.artist_id === artistId)) return;
    const newShares = [...linkShares, { artist_id: artistId, share_percent: 0 }];
    // Auto-distribute shares equally
    const equalShare = 1 / newShares.length;
    setLinkShares(newShares.map(s => ({ ...s, share_percent: equalShare })));
  };

  const removeArtistFromLink = (artistId: string) => {
    const newShares = linkShares.filter(s => s.artist_id !== artistId);
    if (newShares.length > 0) {
      const equalShare = 1 / newShares.length;
      setLinkShares(newShares.map(s => ({ ...s, share_percent: equalShare })));
    } else {
      setLinkShares([]);
    }
  };

  const updateShare = (artistId: string, share: number) => {
    setLinkShares(linkShares.map(s =>
      s.artist_id === artistId ? { ...s, share_percent: share } : s
    ));
  };

  const handleSaveLinks = async () => {
    if (!linkingTrack || linkShares.length === 0) return;

    const totalShare = linkShares.reduce((sum, s) => sum + s.share_percent, 0);
    if (Math.abs(totalShare - 1) > 0.01) {
      setError('Les parts doivent totaliser 100%');
      return;
    }

    setSavingLink(true);
    try {
      await linkArtistsToTrack(linkingTrack.isrc, linkShares);
      setLinkingTrack(null);
      setLinkShares([]);
      loadTracks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingLink(false);
    }
  };

  const applySuggestion = (suggestion: CollaborationSuggestion) => {
    const equalShare = parseFloat(suggestion.suggested_equal_split);
    const shares = suggestion.detected_artists
      .filter(a => a.exists && a.artist_id)
      .map(a => ({
        artist_id: a.artist_id!,
        share_percent: equalShare,
      }));

    // Find the track in our tracks list or create a temporary one
    const track: CatalogTrackWithLinks = {
      isrc: suggestion.isrc,
      track_title: suggestion.track_title,
      release_title: '',
      total_gross: '0',
      total_streams: 0,
      original_artist_name: suggestion.original_artist_name,
      linked_artists: [],
      is_linked: false,
    };

    setLinkingTrack(track);
    setLinkShares(shares);
  };

  const handleCreateArtist = async (artistName: string) => {
    setCreatingArtist(artistName);
    try {
      await createArtist(artistName);
      // Reload managed artists and suggestions
      const [managedData, suggestionsData] = await Promise.all([
        getArtists(),
        getCollaborationSuggestions(50),
      ]);
      setManagedArtists(managedData);
      setSuggestions(suggestionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la creation');
    } finally {
      setCreatingArtist(null);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('fr-FR', { style: 'currency', currency });
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('fr-FR');
  };

  const getArtistName = (artistId: string) => {
    return managedArtists.find(a => a.id === artistId)?.name || 'Inconnu';
  };

  return (
    <>
      <header className="bg-background border-b border-divider sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-foreground">Catalogue</h1>
          <p className="text-sm text-default-500 mt-1">
            Donnees extraites des imports TuneCore
          </p>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-default-100 p-1 rounded-xl">
            <button
              onClick={() => setTab('artists')}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                tab === 'artists'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-default-600 hover:text-foreground'
              }`}
            >
              Artistes
            </button>
            <button
              onClick={() => setTab('tracks')}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                tab === 'tracks'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-default-600 hover:text-foreground'
              }`}
            >
              Tracks
            </button>
            <button
              onClick={() => setTab('collaborations')}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                tab === 'collaborations'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-default-600 hover:text-foreground'
              }`}
            >
              Collabs
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Search/Filter for tracks */}
        {tab === 'tracks' && (
          <div className="mb-4 space-y-3">
            <Input
              placeholder="Rechercher un track ou artiste..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setFilterLinked(null)}
                className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
                  filterLinked === null
                    ? 'bg-foreground text-background'
                    : 'bg-default-100 text-default-600'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => setFilterLinked(true)}
                className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
                  filterLinked === true
                    ? 'bg-success text-white'
                    : 'bg-default-100 text-default-600'
                }`}
              >
                Lies
              </button>
              <button
                onClick={() => setFilterLinked(false)}
                className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
                  filterLinked === false
                    ? 'bg-warning text-white'
                    : 'bg-default-100 text-default-600'
                }`}
              >
                Non lies
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <Spinner size="lg" color="primary" />
            <p className="text-default-500 mt-3">Chargement...</p>
          </div>
        ) : error ? (
          <Card className="bg-danger-50">
            <CardBody className="text-center py-12">
              <p className="text-danger">{error}</p>
              <Button variant="secondary" onClick={() => { setError(null); loadData(); }} className="mt-4">
                Reessayer
              </Button>
            </CardBody>
          </Card>
        ) : tab === 'artists' ? (
          /* Artists Tab */
          artists.length === 0 ? (
            <Card>
              <CardBody className="py-12 text-center">
                <p className="text-default-500">Aucun artiste</p>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {artists.map((artist) => (
                <Link
                  key={artist.artist_name}
                  href={`/catalog/${encodeURIComponent(artist.artist_name)}`}
                >
                  <Card isPressable className="w-full" shadow="sm">
                    <CardBody className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{artist.artist_name}</p>
                          <p className="text-sm text-default-500 mt-1">
                            {artist.release_count} releases · {artist.track_count} tracks
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-medium text-foreground">{formatCurrency(artist.total_gross, artist.currency)}</p>
                          <p className="text-sm text-default-500">{formatNumber(artist.total_streams)} streams</p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          )
        ) : tab === 'tracks' ? (
          /* Tracks Tab */
          tracks.length === 0 ? (
            <Card>
              <CardBody className="py-12 text-center">
                <p className="text-default-500">Aucun track trouve</p>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {tracks.map((track) => (
                <Card key={track.isrc} shadow="sm">
                  <CardBody className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{track.track_title}</p>
                        <p className="text-sm text-default-500 truncate">{track.release_title}</p>
                        <p className="text-xs text-default-400 font-mono mt-1">ISRC: {track.isrc}</p>
                        <p className="text-sm text-default-600 mt-2">
                          Original: <span className="font-medium">{track.original_artist_name}</span>
                        </p>
                        {track.is_linked && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {track.linked_artists.map(link => (
                              <span
                                key={link.artist_id}
                                className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs bg-success-100 text-success-700"
                              >
                                {link.artist_name}: {(parseFloat(link.share_percent) * 100).toFixed(0)}%
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <p className="font-medium text-foreground">{formatCurrency(track.total_gross)}</p>
                          <p className="text-xs text-default-500">{formatNumber(track.total_streams)} streams</p>
                        </div>
                        <Button
                          size="sm"
                          variant={track.is_linked ? 'secondary' : 'primary'}
                          onClick={() => openLinkModal(track)}
                        >
                          {track.is_linked ? 'Modifier' : 'Lier'}
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )
        ) : (
          /* Collaborations Tab */
          suggestions.length === 0 ? (
            <Card>
              <CardBody className="py-12 text-center">
                <p className="text-default-500">Aucune collaboration detectee</p>
                <p className="text-sm text-default-400 mt-2">
                  Les collaborations sont detectees automatiquement (ex: "Artiste A & Artiste B")
                </p>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="bg-warning-50 border border-warning-200 rounded-xl p-3 mb-4">
                <p className="text-sm text-warning-700">
                  <strong>{suggestions.length} collaboration(s)</strong> detectee(s). Le % represente la part du revenu brut attribuee a chaque artiste. Le contrat de chaque artiste s'applique ensuite (part artiste / part label).
                </p>
              </div>
              {suggestions.map((suggestion) => {
                const allArtistsExist = suggestion.detected_artists.every(a => a.exists);
                const missingArtists = suggestion.detected_artists.filter(a => !a.exists);

                return (
                  <Card key={suggestion.isrc} shadow="sm">
                    <CardBody className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{suggestion.track_title}</p>
                          <p className="text-sm text-warning mt-1">{suggestion.original_artist_name}</p>
                        </div>
                        {allArtistsExist ? (
                          <Button
                            size="sm"
                            onClick={() => applySuggestion(suggestion)}
                          >
                            Configurer
                          </Button>
                        ) : (
                          <span className="text-xs text-warning-700 bg-warning-100 px-2 py-1 rounded-lg">
                            {missingArtists.length} artiste(s) a creer
                          </span>
                        )}
                      </div>

                      <div className="mt-3 space-y-2">
                        {suggestion.detected_artists.map((artist, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between p-2 rounded-xl ${
                              artist.exists
                                ? 'bg-success-50 border border-success-200'
                                : 'bg-default-50 border border-default-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {artist.exists ? (
                                <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              )}
                              <span className={`text-sm font-medium ${artist.exists ? 'text-success-700' : 'text-default-600'}`}>
                                {artist.name}
                              </span>
                            </div>
                            {!artist.exists && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleCreateArtist(artist.name)}
                                loading={creatingArtist === artist.name}
                                disabled={!!creatingArtist}
                              >
                                Creer
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>

                      <p className="text-xs text-default-400 mt-3">
                        Split suggere: {(parseFloat(suggestion.suggested_equal_split) * 100).toFixed(0)}% du brut chacun
                      </p>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Link Modal */}
      {linkingTrack && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Lier artistes au track</h2>
                <button onClick={() => setLinkingTrack(null)} className="p-2 -mr-2 text-default-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div className="bg-default-50 rounded-xl p-3">
                <p className="font-medium text-foreground">{linkingTrack.track_title}</p>
                <p className="text-sm text-default-500">{linkingTrack.original_artist_name}</p>
                <p className="text-xs text-default-400 font-mono mt-1">ISRC: {linkingTrack.isrc}</p>
              </div>

              <div className="bg-primary-50 border border-primary-200 rounded-xl p-3">
                <p className="text-xs text-primary-700">
                  Les % representent la repartition du <strong>revenu brut</strong> entre les artistes. Le contrat de chaque artiste (part artiste/label) s'applique ensuite.
                </p>
              </div>

              {/* Selected artists with shares */}
              {linkShares.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-default-700">Repartition du brut:</p>
                  {linkShares.map((share) => (
                    <div key={share.artist_id} className="flex items-center gap-3 bg-default-50 rounded-xl p-3">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{getArtistName(share.artist_id)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={Math.round(share.share_percent * 100)}
                          onChange={(e) => updateShare(share.artist_id, parseInt(e.target.value) / 100)}
                          className="w-16 px-2 py-1 border border-divider rounded-lg text-center text-sm bg-background"
                        />
                        <span className="text-sm text-default-500">%</span>
                        <button
                          onClick={() => removeArtistFromLink(share.artist_id)}
                          className="p-1 text-default-400 hover:text-danger transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className={`text-sm ${
                    Math.abs(linkShares.reduce((sum, s) => sum + s.share_percent, 0) - 1) < 0.01
                      ? 'text-success'
                      : 'text-danger'
                  }`}>
                    Total: {Math.round(linkShares.reduce((sum, s) => sum + s.share_percent, 0) * 100)}%
                    {Math.abs(linkShares.reduce((sum, s) => sum + s.share_percent, 0) - 1) >= 0.01 && ' (doit etre 100%)'}
                  </p>
                </div>
              )}

              {/* Add artist */}
              <div>
                <p className="text-sm font-medium text-default-700 mb-2">Ajouter un artiste:</p>
                <select
                  onChange={(e) => {
                    if (e.target.value) addArtistToLink(e.target.value);
                    e.target.value = '';
                  }}
                  className="w-full h-12 px-3 border-2 border-default-200 bg-default-100 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">-- Choisir un artiste --</option>
                  {managedArtists
                    .filter(a => !linkShares.some(s => s.artist_id === a.id))
                    .map((artist) => (
                      <option key={artist.id} value={artist.id}>
                        {artist.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-divider flex gap-3">
              <Button variant="secondary" onClick={() => setLinkingTrack(null)} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={handleSaveLinks}
                loading={savingLink}
                disabled={linkShares.length === 0 || Math.abs(linkShares.reduce((sum, s) => sum + s.share_percent, 0) - 1) >= 0.01}
                className="flex-1"
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
