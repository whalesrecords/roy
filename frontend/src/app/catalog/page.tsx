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
  downloadCatalogCsv,
  listManualReleases,
  createManualRelease,
  updateManualRelease,
  deleteManualRelease,
  addTrackToRelease,
  updateManualTrack,
  deleteManualTrack,
  CatalogArtist,
  CatalogTrackWithLinks,
  CollaborationSuggestion,
  Artist,
  ManualReleaseData,
  ManualTrackData,
} from '@/lib/api';

type Tab = 'artists' | 'tracks' | 'collaborations' | 'releases';

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
  const [exporting, setExporting] = useState(false);

  // Link modal state
  const [linkingTrack, setLinkingTrack] = useState<CatalogTrackWithLinks | null>(null);
  const [linkShares, setLinkShares] = useState<{ artist_id: string; share_percent: number }[]>([]);
  const [savingLink, setSavingLink] = useState(false);

  // Create artist state
  const [creatingArtist, setCreatingArtist] = useState<string | null>(null);

  // Manual releases state
  const [releases, setReleases] = useState<ManualReleaseData[]>([]);
  const [releaseSearch, setReleaseSearch] = useState('');
  const [releaseArtistFilter, setReleaseArtistFilter] = useState('');
  const [showReleaseForm, setShowReleaseForm] = useState(false);
  const [editingRelease, setEditingRelease] = useState<ManualReleaseData | null>(null);
  const [savingRelease, setSavingRelease] = useState(false);
  const [deletingReleaseId, setDeletingReleaseId] = useState<string | null>(null);
  const [expandedReleaseId, setExpandedReleaseId] = useState<string | null>(null);
  // Track editing within a release
  const [addingTrackReleaseId, setAddingTrackReleaseId] = useState<string | null>(null);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackIsrc, setNewTrackIsrc] = useState('');
  const [newTrackPos, setNewTrackPos] = useState('');
  const [savingTrack, setSavingTrack] = useState(false);
  // Release form state
  const [releaseForm, setReleaseForm] = useState({
    title: '', upc: '', artist_id: '', release_date: '', format: 'album', notes: '',
  });

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
    } else if (tab === 'releases') {
      loadReleases();
    }
  }, [tab, searchQuery, filterLinked, releaseSearch, releaseArtistFilter]);

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

  const loadReleases = async () => {
    setLoading(true);
    try {
      const data = await listManualReleases({
        artist_id: releaseArtistFilter || undefined,
        search: releaseSearch || undefined,
      });
      setReleases(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement albums');
    } finally {
      setLoading(false);
    }
  };

  const openNewReleaseForm = () => {
    setEditingRelease(null);
    setReleaseForm({ title: '', upc: '', artist_id: '', release_date: '', format: 'album', notes: '' });
    setShowReleaseForm(true);
  };

  const openEditReleaseForm = (r: ManualReleaseData) => {
    setEditingRelease(r);
    setReleaseForm({
      title: r.title,
      upc: r.upc || '',
      artist_id: r.artist_id || '',
      release_date: r.release_date || '',
      format: r.format || 'album',
      notes: r.notes || '',
    });
    setShowReleaseForm(true);
  };

  const handleSaveRelease = async () => {
    if (!releaseForm.title.trim()) return;
    setSavingRelease(true);
    try {
      const payload = {
        title: releaseForm.title.trim(),
        upc: releaseForm.upc.trim() || undefined,
        artist_id: releaseForm.artist_id || undefined,
        release_date: releaseForm.release_date || undefined,
        format: releaseForm.format || undefined,
        notes: releaseForm.notes.trim() || undefined,
      };
      if (editingRelease) {
        await updateManualRelease(editingRelease.id, payload);
      } else {
        await createManualRelease(payload);
      }
      setShowReleaseForm(false);
      setEditingRelease(null);
      loadReleases();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur sauvegarde album');
    } finally {
      setSavingRelease(false);
    }
  };

  const handleDeleteRelease = async (id: string) => {
    setDeletingReleaseId(id);
    try {
      await deleteManualRelease(id);
      loadReleases();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur suppression');
    } finally {
      setDeletingReleaseId(null);
    }
  };

  const handleAddTrack = async (releaseId: string) => {
    if (!newTrackTitle.trim()) return;
    setSavingTrack(true);
    try {
      await addTrackToRelease(releaseId, {
        title: newTrackTitle.trim(),
        isrc: newTrackIsrc.trim() || undefined,
        position: newTrackPos ? parseInt(newTrackPos) : undefined,
      });
      setAddingTrackReleaseId(null);
      setNewTrackTitle(''); setNewTrackIsrc(''); setNewTrackPos('');
      loadReleases();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur ajout titre');
    } finally {
      setSavingTrack(false);
    }
  };

  const handleDeleteTrack = async (releaseId: string, trackId: string) => {
    try {
      await deleteManualTrack(releaseId, trackId);
      loadReleases();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur suppression titre');
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
      <header className="bg-background/80 backdrop-blur-md border-b border-divider sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Catalogue</h1>
              <p className="text-secondary-500 text-sm mt-0.5">Donnees extraites des imports</p>
            </div>
            <button
              onClick={async () => {
                setExporting(true);
                try { await downloadCatalogCsv(); } finally { setExporting(false); }
              }}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-content2 hover:bg-content3 text-sm font-medium text-foreground transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              {exporting ? 'Export…' : 'Export CSV'}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'artists', label: 'Artistes', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z' },
              { key: 'releases', label: 'Albums', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
              { key: 'tracks', label: 'Tracks', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
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

        {/* ===== Albums tab ===== */}
        {tab === 'releases' && (
          <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Rechercher un album…"
                  value={releaseSearch}
                  onChange={(e) => setReleaseSearch(e.target.value)}
                  className="w-full h-10 px-4 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <select
                  value={releaseArtistFilter}
                  onChange={(e) => setReleaseArtistFilter(e.target.value)}
                  className="h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">Tous les artistes</option>
                  {managedArtists.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={openNewReleaseForm}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-medium text-sm rounded-full shadow-lg shadow-primary/30 hover:shadow-xl transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nouvel album
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : releases.length === 0 ? (
              <div className="text-center py-16 text-secondary-500">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <p className="font-medium">Aucun album enregistré</p>
                <p className="text-sm mt-1">Cliquez sur « Nouvel album » pour en ajouter un</p>
              </div>
            ) : (
              <div className="space-y-3">
                {releases.map((rel) => (
                  <div key={rel.id} className="bg-background border border-divider rounded-2xl shadow-sm overflow-hidden">
                    {/* Release header */}
                    <div className="px-5 py-4 flex items-center gap-4">
                      <button
                        onClick={() => setExpandedReleaseId(expandedReleaseId === rel.id ? null : rel.id)}
                        className="flex-1 flex items-center gap-4 text-left min-w-0"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{rel.title}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {rel.artist_name && (
                              <span className="text-sm text-secondary-500">{rel.artist_name}</span>
                            )}
                            {rel.upc && (
                              <span className="text-xs font-mono text-secondary-400 bg-content2 px-2 py-0.5 rounded">UPC: {rel.upc}</span>
                            )}
                            {rel.format && (
                              <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full capitalize">{rel.format}</span>
                            )}
                            {rel.release_date && (
                              <span className="text-xs text-secondary-400">{rel.release_date}</span>
                            )}
                            <span className="text-xs text-secondary-400">{rel.tracks.length} titre{rel.tracks.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <svg
                          className={`w-5 h-5 text-secondary-400 shrink-0 transition-transform ${expandedReleaseId === rel.id ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => openEditReleaseForm(rel)}
                          className="p-2 text-secondary-400 hover:text-primary transition-colors"
                          title="Modifier"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => { if (confirm(`Supprimer « ${rel.title} » ?`)) handleDeleteRelease(rel.id); }}
                          disabled={deletingReleaseId === rel.id}
                          className="p-2 text-secondary-400 hover:text-danger transition-colors disabled:opacity-50"
                          title="Supprimer"
                        >
                          {deletingReleaseId === rel.id ? <Spinner size="sm" /> : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded: track list */}
                    {expandedReleaseId === rel.id && (
                      <div className="border-t border-divider px-5 py-4 space-y-3">
                        {rel.tracks.length === 0 && addingTrackReleaseId !== rel.id && (
                          <p className="text-sm text-secondary-400 text-center py-2">Aucun titre — ajoutez-en un</p>
                        )}
                        {rel.tracks.map((t) => (
                          <div key={t.id} className="flex items-center gap-3 p-3 bg-content2 rounded-xl">
                            {t.position !== null && (
                              <span className="text-xs font-mono text-secondary-400 w-6 text-center shrink-0">{t.position}</span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                              {t.isrc && (
                                <p className="text-xs font-mono text-secondary-400 mt-0.5">ISRC: {t.isrc}</p>
                              )}
                            </div>
                            <button
                              onClick={() => { if (confirm(`Supprimer « ${t.title} » ?`)) handleDeleteTrack(rel.id, t.id); }}
                              className="p-1.5 text-secondary-400 hover:text-danger transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}

                        {/* Add track inline */}
                        {addingTrackReleaseId === rel.id ? (
                          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                            <p className="text-sm font-semibold text-foreground">Nouveau titre</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                type="text"
                                placeholder="Titre *"
                                value={newTrackTitle}
                                onChange={(e) => setNewTrackTitle(e.target.value)}
                                className="h-9 px-3 bg-background border border-default-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                              />
                              <input
                                type="text"
                                placeholder="ISRC (ex: FR1234567890)"
                                value={newTrackIsrc}
                                onChange={(e) => setNewTrackIsrc(e.target.value.toUpperCase())}
                                className="h-9 px-3 bg-background border border-default-200 rounded-lg text-sm font-mono focus:outline-none focus:border-primary"
                              />
                              <input
                                type="number"
                                placeholder="N° (position)"
                                value={newTrackPos}
                                onChange={(e) => setNewTrackPos(e.target.value)}
                                className="h-9 px-3 bg-background border border-default-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAddTrack(rel.id)}
                                disabled={savingTrack || !newTrackTitle.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg disabled:opacity-50"
                              >
                                {savingTrack ? <Spinner size="sm" color="white" /> : 'Ajouter'}
                              </button>
                              <button
                                onClick={() => { setAddingTrackReleaseId(null); setNewTrackTitle(''); setNewTrackIsrc(''); setNewTrackPos(''); }}
                                className="px-4 py-2 text-sm text-secondary-600 hover:text-foreground"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAddingTrackReleaseId(rel.id); setNewTrackTitle(''); setNewTrackIsrc(''); setNewTrackPos(''); }}
                            className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Ajouter un titre
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Release Form Modal */}
      {showReleaseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setShowReleaseForm(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-divider flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{editingRelease ? 'Modifier album' : 'Nouvel album'}</h2>
              <button onClick={() => setShowReleaseForm(false)} className="p-2 -mr-2 text-secondary-400 hover:text-foreground">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Titre *</label>
                <input
                  type="text"
                  value={releaseForm.title}
                  onChange={(e) => setReleaseForm({ ...releaseForm, title: e.target.value })}
                  placeholder="Nom de l'album / EP / single"
                  className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-secondary-500 mb-1.5 block">UPC</label>
                  <input
                    type="text"
                    value={releaseForm.upc}
                    onChange={(e) => setReleaseForm({ ...releaseForm, upc: e.target.value })}
                    placeholder="0012345678901"
                    className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm font-mono focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Format</label>
                  <select
                    value={releaseForm.format}
                    onChange={(e) => setReleaseForm({ ...releaseForm, format: e.target.value })}
                    className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="album">Album</option>
                    <option value="ep">EP</option>
                    <option value="single">Single</option>
                    <option value="compilation">Compilation</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Artiste</label>
                  <select
                    value={releaseForm.artist_id}
                    onChange={(e) => setReleaseForm({ ...releaseForm, artist_id: e.target.value })}
                    className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="">Aucun / compilation</option>
                    {managedArtists.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Date de sortie</label>
                  <input
                    type="date"
                    value={releaseForm.release_date}
                    onChange={(e) => setReleaseForm({ ...releaseForm, release_date: e.target.value })}
                    className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Notes</label>
                <textarea
                  value={releaseForm.notes}
                  onChange={(e) => setReleaseForm({ ...releaseForm, notes: e.target.value })}
                  placeholder="Notes internes…"
                  rows={2}
                  className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-divider flex justify-end gap-3">
              <button
                onClick={() => setShowReleaseForm(false)}
                className="px-5 py-2.5 text-sm text-secondary-600 hover:text-foreground transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveRelease}
                disabled={savingRelease || !releaseForm.title.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-medium text-sm rounded-full shadow-lg shadow-primary/30 hover:shadow-xl disabled:opacity-50 transition-all"
              >
                {savingRelease ? <Spinner size="sm" color="white" /> : (editingRelease ? 'Enregistrer' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}

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
