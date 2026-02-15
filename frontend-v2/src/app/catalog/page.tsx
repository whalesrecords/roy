'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Spinner } from '@heroui/react';
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
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-md border-b border-divider sticky top-14 z-30">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Catalogue</h1>
              <p className="text-secondary-500 text-sm mt-0.5">Donnees extraites des imports</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {[
              { key: 'artists', label: 'Artistes', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z' },
              { key: 'tracks', label: 'Tracks', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
              { key: 'collaborations', label: 'Collabs', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as Tab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${
                  tab === t.key
                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                    : 'bg-content2 text-secondary-600 hover:bg-content3'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
                </svg>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Search/Filter for tracks */}
        {tab === 'tracks' && (
          <div className="mb-6 space-y-4">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher un track ou artiste..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-12 pr-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex gap-2">
              {[
                { value: null, label: 'Tous', color: 'default' },
                { value: true, label: 'Lies', color: 'success' },
                { value: false, label: 'Non lies', color: 'warning' },
              ].map((f) => (
                <button
                  key={String(f.value)}
                  onClick={() => setFilterLinked(f.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    filterLinked === f.value
                      ? f.color === 'success'
                        ? 'bg-success text-white shadow-lg shadow-success/30'
                        : f.color === 'warning'
                        ? 'bg-warning text-white shadow-lg shadow-warning/30'
                        : 'bg-foreground text-background'
                      : 'bg-content2 text-secondary-600 hover:bg-content3'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <Spinner size="lg" color="primary" />
            <p className="text-secondary-500 mt-4">Chargement...</p>
          </div>
        ) : error ? (
          <div className="bg-danger-50 border border-danger-200 rounded-2xl p-8 text-center">
            <p className="text-danger font-medium mb-4">{error}</p>
            <button
              onClick={() => { setError(null); loadData(); }}
              className="px-5 py-2.5 border-2 border-default-300 text-foreground font-medium rounded-full hover:bg-default-100 transition-colors"
            >
              Reessayer
            </button>
          </div>
        ) : tab === 'artists' ? (
          /* Artists Tab */
          artists.length === 0 ? (
            <div className="bg-background border border-divider rounded-2xl p-12 text-center">
              <p className="text-secondary-500">Aucun artiste</p>
            </div>
          ) : (
            <div className="space-y-3">
              {artists.map((artist) => (
                <Link
                  key={artist.artist_name}
                  href={`/catalog/${encodeURIComponent(artist.artist_name)}`}
                  className="block"
                >
                  <div className="bg-background border border-divider rounded-2xl p-5 hover:shadow-lg hover:border-primary/30 transition-all duration-200 group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                          <svg className="w-6 h-6 text-primary group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{artist.artist_name}</p>
                          <p className="text-sm text-secondary-500 mt-0.5">
                            {artist.release_count} releases · {artist.track_count} tracks
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-foreground">{formatCurrency(artist.total_gross, artist.currency)}</p>
                        <p className="text-sm text-secondary-500">{formatNumber(artist.total_streams)} streams</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : tab === 'tracks' ? (
          /* Tracks Tab */
          tracks.length === 0 ? (
            <div className="bg-background border border-divider rounded-2xl p-12 text-center">
              <p className="text-secondary-500">Aucun track trouve</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tracks.map((track) => (
                <div key={track.isrc} className="bg-background border border-divider rounded-2xl p-5 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${track.is_linked ? 'bg-success/10' : 'bg-warning/10'}`}>
                        <svg className={`w-5 h-5 ${track.is_linked ? 'text-success' : 'text-warning'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{track.track_title}</p>
                        <p className="text-sm text-secondary-500 truncate">{track.release_title}</p>
                        <p className="text-xs text-secondary-400 font-mono mt-1">ISRC: {track.isrc}</p>
                        <p className="text-sm text-secondary-600 mt-2">
                          Original: <span className="font-medium">{track.original_artist_name}</span>
                        </p>
                        {track.is_linked && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {track.linked_artists.map(link => (
                              <span
                                key={link.artist_id}
                                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-success-100 text-success-700 border border-success-200"
                              >
                                {link.artist_name}: {(parseFloat(link.share_percent) * 100).toFixed(0)}%
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <div className="text-right">
                        <p className="font-bold text-foreground">{formatCurrency(track.total_gross)}</p>
                        <p className="text-xs text-secondary-500">{formatNumber(track.total_streams)} streams</p>
                      </div>
                      <button
                        onClick={() => openLinkModal(track)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                          track.is_linked
                            ? 'bg-content2 text-secondary-600 hover:bg-content3'
                            : 'bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl'
                        }`}
                      >
                        {track.is_linked ? 'Modifier' : 'Lier'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Collaborations Tab */
          suggestions.length === 0 ? (
            <div className="bg-background border border-divider rounded-2xl p-12 text-center">
              <p className="text-secondary-500">Aucune collaboration detectee</p>
              <p className="text-sm text-secondary-400 mt-2">
                Les collaborations sont detectees automatiquement (ex: "Artiste A & Artiste B")
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-warning-50 border border-warning-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-warning-100 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-warning-700">
                    <strong>{suggestions.length} collaboration(s)</strong> detectee(s). Le % represente la part du revenu brut attribuee a chaque artiste.
                  </p>
                </div>
              </div>

              {suggestions.map((suggestion) => {
                const allArtistsExist = suggestion.detected_artists.every(a => a.exists);
                const missingArtists = suggestion.detected_artists.filter(a => !a.exists);

                return (
                  <div key={suggestion.isrc} className="bg-background border border-divider rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{suggestion.track_title}</p>
                        <p className="text-sm text-warning-600 mt-1">{suggestion.original_artist_name}</p>
                      </div>
                      {allArtistsExist ? (
                        <button
                          onClick={() => applySuggestion(suggestion)}
                          className="px-4 py-2 bg-primary text-white font-medium text-sm rounded-full shadow-lg shadow-primary/30 hover:shadow-xl transition-all"
                        >
                          Configurer
                        </button>
                      ) : (
                        <span className="text-xs text-warning-700 bg-warning-100 px-3 py-1.5 rounded-full border border-warning-200">
                          {missingArtists.length} artiste(s) a creer
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {suggestion.detected_artists.map((artist, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-3 rounded-xl ${
                            artist.exists
                              ? 'bg-success-50 border border-success-200'
                              : 'bg-content2 border border-divider'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {artist.exists ? (
                              <div className="w-6 h-6 rounded-full bg-success-100 flex items-center justify-center">
                                <svg className="w-3.5 h-3.5 text-success-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-default-200 flex items-center justify-center">
                                <svg className="w-3.5 h-3.5 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </div>
                            )}
                            <span className={`text-sm font-medium ${artist.exists ? 'text-success-700' : 'text-secondary-600'}`}>
                              {artist.name}
                            </span>
                          </div>
                          {!artist.exists && (
                            <button
                              onClick={() => handleCreateArtist(artist.name)}
                              disabled={!!creatingArtist}
                              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-full disabled:opacity-50 transition-all"
                            >
                              {creatingArtist === artist.name ? (
                                <Spinner size="sm" color="white" />
                              ) : (
                                'Creer'
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-secondary-400 mt-3">
                      Split suggere: {(parseFloat(suggestion.suggested_equal_split) * 100).toFixed(0)}% du brut chacun
                    </p>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Link Modal */}
      {linkingTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setLinkingTrack(null)}
          />
          <div className="relative bg-background rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-divider flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Lier artistes au track</h2>
              <button onClick={() => setLinkingTrack(null)} className="p-2 -mr-2 text-secondary-400 hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto max-h-[60vh] space-y-5">
              <div className="bg-content2 rounded-xl p-4">
                <p className="font-semibold text-foreground">{linkingTrack.track_title}</p>
                <p className="text-sm text-secondary-500">{linkingTrack.original_artist_name}</p>
                <p className="text-xs text-secondary-400 font-mono mt-1">ISRC: {linkingTrack.isrc}</p>
              </div>

              <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
                <p className="text-xs text-primary-700">
                  Les % representent la repartition du <strong>revenu brut</strong> entre les artistes. Le contrat de chaque artiste s'applique ensuite.
                </p>
              </div>

              {/* Selected artists with shares */}
              {linkShares.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Repartition du brut:</p>
                  {linkShares.map((share) => (
                    <div key={share.artist_id} className="flex items-center gap-3 bg-content2 rounded-xl p-4">
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
                          className="w-16 px-3 py-2 border-2 border-default-200 rounded-xl text-center text-sm bg-background focus:outline-none focus:border-primary transition-colors"
                        />
                        <span className="text-sm text-secondary-500">%</span>
                        <button
                          onClick={() => removeArtistFromLink(share.artist_id)}
                          className="p-2 text-secondary-400 hover:text-danger transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className={`text-sm font-medium ${
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
                <p className="text-sm font-semibold text-foreground mb-2">Ajouter un artiste:</p>
                <select
                  onChange={(e) => {
                    if (e.target.value) addArtistToLink(e.target.value);
                    e.target.value = '';
                  }}
                  className="w-full h-12 px-4 border-2 border-default-200 bg-background rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
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

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-divider flex gap-3 bg-content2/50">
              <button
                onClick={() => setLinkingTrack(null)}
                className="flex-1 px-5 py-2.5 border-2 border-default-300 text-foreground font-medium rounded-full hover:bg-default-100 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveLinks}
                disabled={savingLink || linkShares.length === 0 || Math.abs(linkShares.reduce((sum, s) => sum + s.share_percent, 0) - 1) >= 0.01}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white font-medium rounded-full disabled:opacity-50 shadow-lg shadow-primary/30 transition-all"
              >
                {savingLink && <Spinner size="sm" color="white" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
