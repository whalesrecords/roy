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
import { Card, Eyebrow, Pill, Avatar, AccentButton, OutlineButton } from '@/components/roy/ui';
import {
  IconUsers, IconMusic, IconBox, IconSparkles, IconDownload, IconPlus,
  IconCheck, IconChevronRight,
} from '@/components/roy/icons';

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

  const inputClass =
    'w-full h-10 px-3 bg-surface border border-line rounded-[10px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors';
  const labelClass = 'roy-eyebrow text-[9.5px] mb-1.5 block';

  const TABS: { key: Tab; label: string; icon: typeof IconUsers }[] = [
    { key: 'artists', label: 'Artistes', icon: IconUsers },
    { key: 'releases', label: 'Albums', icon: IconMusic },
    { key: 'tracks', label: 'Tracks', icon: IconBox },
    { key: 'collaborations', label: 'Collabs', icon: IconSparkles },
  ];

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div>
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Catalogue</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">
            {artists.length} artiste{artists.length > 1 ? 's' : ''} · données extraites des imports
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {tab === 'tracks' && (
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher un track…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-[38px] w-full sm:w-[240px] pl-9 pr-3 rounded-[10px] border border-line bg-surface text-[12.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors"
              />
            </div>
          )}
          {tab === 'releases' && (
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher un album…"
                value={releaseSearch}
                onChange={(e) => setReleaseSearch(e.target.value)}
                className="h-[38px] w-full sm:w-[240px] pl-9 pr-3 rounded-[10px] border border-line bg-surface text-[12.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors"
              />
            </div>
          )}
          {tab === 'releases' ? (
            <AccentButton onClick={openNewReleaseForm}>
              <IconPlus size={14} /> Nouvel album
            </AccentButton>
          ) : (
            <OutlineButton
              onClick={async () => {
                setExporting(true);
                try { await downloadCatalogCsv(); } finally { setExporting(false); }
              }}
            >
              {exporting ? <Spinner size="sm" /> : <IconDownload size={14} />}
              Export CSV
            </OutlineButton>
          )}
        </div>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {/* Tabs */}
        <div className="flex gap-1 rounded-[11px] border border-line bg-surface p-1 w-fit">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12.5px] transition-colors ${
                  tab === t.key
                    ? 'bg-accent-soft text-accent font-semibold'
                    : 'text-ink-muted hover:text-ink font-medium'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tracks filter */}
        {tab === 'tracks' && (
          <div className="flex gap-1 rounded-[11px] border border-line bg-surface p-1 w-fit">
            {[
              { value: null, label: 'Tous' },
              { value: true, label: 'Liés' },
              { value: false, label: 'Non liés' },
            ].map((f) => (
              <button
                key={String(f.value)}
                onClick={() => setFilterLinked(f.value)}
                className={`px-4 py-1.5 rounded-lg text-[12.5px] transition-colors ${
                  filterLinked === f.value
                    ? 'bg-accent-soft text-accent font-semibold'
                    : 'text-ink-muted hover:text-ink font-medium'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-[12px] border border-line bg-surface px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-neg text-[12.5px]">{error}</p>
            <OutlineButton onClick={() => { setError(null); loadData(); }}>Réessayer</OutlineButton>
          </div>
        )}

        {loading ? (
          <Card className="flex flex-col items-center justify-center py-16">
            <Spinner size="lg" />
            <p className="text-ink-faint text-[12.5px] mt-4">Chargement…</p>
          </Card>
        ) : tab === 'artists' ? (
          /* ===== Artists Tab ===== */
          <Card padded={false} className="overflow-hidden">
            {artists.length === 0 ? (
              <div className="px-[22px] py-16 text-center">
                <p className="text-ink-faint text-[13px]">Aucun artiste</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[2fr_1.2fr_1.1fr_1fr] px-[22px] py-3 border-b border-line">
                  <Eyebrow className="text-[10px]">Artiste</Eyebrow>
                  <Eyebrow className="text-[10px]">Catalogue</Eyebrow>
                  <Eyebrow className="text-[10px] text-right">Revenus</Eyebrow>
                  <Eyebrow className="text-[10px] text-right">Streams</Eyebrow>
                </div>
                {artists.map((artist, i) => (
                  <Link
                    key={artist.artist_name}
                    href={`/catalog/${encodeURIComponent(artist.artist_name)}`}
                    className="grid grid-cols-[2fr_1.2fr_1.1fr_1fr] items-center px-[22px] py-3.5 border-b border-line last:border-0 hover:bg-surface-2 transition-colors"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={artist.artist_name} size={34} accent={i === 0} />
                      <span className="text-[13.5px] font-semibold text-ink truncate">{artist.artist_name}</span>
                    </span>
                    <span className="text-[12.5px] text-ink-muted">
                      {artist.release_count} releases · {artist.track_count} tracks
                    </span>
                    <span className="text-right roy-num text-[13px] font-bold text-ink">{formatCurrency(artist.total_gross, artist.currency)}</span>
                    <span className="text-right roy-num text-[13px] text-ink-muted">{formatNumber(artist.total_streams)}</span>
                  </Link>
                ))}
              </>
            )}
          </Card>
        ) : tab === 'tracks' ? (
          /* ===== Tracks Tab ===== */
          tracks.length === 0 ? (
            <Card className="py-16 text-center">
              <p className="text-ink-faint text-[13px]">Aucun track trouvé</p>
            </Card>
          ) : (
            <Card padded={false} className="overflow-hidden">
              <div className="grid grid-cols-[2.4fr_1.4fr_1fr_0.9fr] px-[22px] py-3 border-b border-line">
                <Eyebrow className="text-[10px]">Track</Eyebrow>
                <Eyebrow className="text-[10px]">Original / Liens</Eyebrow>
                <Eyebrow className="text-[10px] text-right">Revenus</Eyebrow>
                <Eyebrow className="text-[10px] text-center">Action</Eyebrow>
              </div>
              {tracks.map((track) => (
                <div
                  key={track.isrc}
                  className="grid grid-cols-[2.4fr_1.4fr_1fr_0.9fr] items-center px-[22px] py-3.5 border-b border-line last:border-0 hover:bg-surface-2 transition-colors"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-9 h-9 rounded-[9px] shrink-0"
                      style={{ background: 'var(--cover)' }}
                    />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-ink truncate">{track.track_title}</span>
                      <span className="block text-[11px] text-ink-faint truncate">{track.release_title}</span>
                      <span className="block text-[10.5px] text-ink-faint font-mono mt-0.5">ISRC {track.isrc}</span>
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] text-ink-muted truncate">{track.original_artist_name}</span>
                    {track.is_linked && (
                      <span className="flex flex-wrap gap-1 mt-1.5">
                        {track.linked_artists.map(link => (
                          <Pill key={link.artist_id} tone="accent">
                            {link.artist_name} · {(parseFloat(link.share_percent) * 100).toFixed(0)}%
                          </Pill>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="text-right">
                    <span className="block roy-num text-[13px] font-bold text-ink">{formatCurrency(track.total_gross)}</span>
                    <span className="block text-[11px] text-ink-faint roy-num">{formatNumber(track.total_streams)} streams</span>
                  </span>
                  <span className="flex justify-center">
                    <button
                      onClick={() => openLinkModal(track)}
                      className={`inline-flex items-center rounded-[8px] px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                        track.is_linked
                          ? 'border border-line bg-surface text-ink-muted hover:text-ink hover:border-line-strong'
                          : 'bg-accent-soft text-accent hover:opacity-90'
                      }`}
                    >
                      {track.is_linked ? 'Modifier' : 'Lier'}
                    </button>
                  </span>
                </div>
              ))}
            </Card>
          )
        ) : tab === 'collaborations' ? (
          /* ===== Collaborations Tab ===== */
          suggestions.length === 0 ? (
            <Card className="py-16 text-center">
              <p className="text-ink-faint text-[13px]">Aucune collaboration détectée</p>
              <p className="text-[12px] text-ink-faint mt-2">
                Les collaborations sont détectées automatiquement (ex: « Artiste A &amp; Artiste B »)
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
                  <IconSparkles size={16} />
                </div>
                <p className="text-[12.5px] text-ink-muted">
                  <strong className="text-ink">{suggestions.length} collaboration(s)</strong> détectée(s). Le % représente la part du revenu brut attribuée à chaque artiste.
                </p>
              </Card>

              {suggestions.map((suggestion) => {
                const allArtistsExist = suggestion.detected_artists.every(a => a.exists);
                const missingArtists = suggestion.detected_artists.filter(a => !a.exists);

                return (
                  <Card key={suggestion.isrc}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold text-ink truncate">{suggestion.track_title}</p>
                        <p className="text-[12px] text-ink-faint mt-0.5">{suggestion.original_artist_name}</p>
                      </div>
                      {allArtistsExist ? (
                        <AccentButton onClick={() => applySuggestion(suggestion)}>Configurer</AccentButton>
                      ) : (
                        <Pill tone="neutral">{missingArtists.length} artiste(s) à créer</Pill>
                      )}
                    </div>

                    <div className="space-y-2">
                      {suggestion.detected_artists.map((artist, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-2.5 rounded-[12px] bg-surface-2"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                              artist.exists ? 'bg-accent-soft text-accent' : 'bg-surface text-ink-faint border border-line'
                            }`}>
                              {artist.exists ? <IconCheck size={12} /> : <IconPlus size={12} />}
                            </span>
                            <span className={`text-[12.5px] font-medium ${artist.exists ? 'text-ink' : 'text-ink-muted'}`}>
                              {artist.name}
                            </span>
                          </div>
                          {!artist.exists && (
                            <button
                              onClick={() => handleCreateArtist(artist.name)}
                              disabled={!!creatingArtist}
                              className="inline-flex items-center gap-1.5 rounded-[8px] bg-accent-soft px-3 py-1.5 text-[11px] font-semibold text-accent hover:opacity-90 disabled:opacity-50 transition-opacity"
                            >
                              {creatingArtist === artist.name ? <Spinner size="sm" /> : 'Créer'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-ink-faint mt-3">
                      Split suggéré: {(parseFloat(suggestion.suggested_equal_split) * 100).toFixed(0)}% du brut chacun
                    </p>
                  </Card>
                );
              })}
            </div>
          )
        ) : null}

        {/* ===== Albums tab ===== */}
        {tab === 'releases' && !loading && (
          <>
            <div className="flex flex-wrap gap-2.5 items-center">
              <select
                value={releaseArtistFilter}
                onChange={(e) => setReleaseArtistFilter(e.target.value)}
                className="h-[38px] px-3 bg-surface border border-line rounded-[10px] text-[12.5px] text-ink focus:outline-none focus:border-line-strong transition-colors"
              >
                <option value="">Tous les artistes</option>
                {managedArtists.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {releases.length === 0 ? (
              <Card className="py-16 text-center">
                <div className="w-12 h-12 rounded-[14px] mx-auto mb-3" style={{ background: 'var(--cover)' }} />
                <p className="text-[13px] font-medium text-ink">Aucun album enregistré</p>
                <p className="text-[12px] text-ink-faint mt-1">Cliquez sur « Nouvel album » pour en ajouter un</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {releases.map((rel) => (
                  <Card key={rel.id} padded={false} className="overflow-hidden">
                    {/* Release header */}
                    <div className="px-[22px] py-4 flex items-center gap-4">
                      <button
                        onClick={() => setExpandedReleaseId(expandedReleaseId === rel.id ? null : rel.id)}
                        className="flex-1 flex items-center gap-3.5 text-left min-w-0"
                      >
                        <span
                          className="w-11 h-11 rounded-[12px] shrink-0"
                          style={{ background: 'var(--cover)' }}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13.5px] font-semibold text-ink truncate">{rel.title}</span>
                          <span className="flex items-center gap-2.5 mt-1 flex-wrap">
                            {rel.artist_name && (
                              <span className="text-[12px] text-ink-muted">{rel.artist_name}</span>
                            )}
                            {rel.upc && (
                              <span className="text-[10.5px] font-mono text-ink-faint bg-surface-2 px-2 py-0.5 rounded-md">UPC {rel.upc}</span>
                            )}
                            {rel.format && (
                              <span className="text-[10.5px] font-semibold text-accent bg-accent-soft px-2 py-0.5 rounded-full capitalize">{rel.format}</span>
                            )}
                            {rel.release_date && (
                              <span className="text-[11px] text-ink-faint">{rel.release_date}</span>
                            )}
                            <span className="text-[11px] text-ink-faint">{rel.tracks.length} titre{rel.tracks.length !== 1 ? 's' : ''}</span>
                          </span>
                        </span>
                        <IconChevronRight
                          size={18}
                          className={`text-ink-faint shrink-0 transition-transform ${expandedReleaseId === rel.id ? 'rotate-90' : ''}`}
                        />
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openEditReleaseForm(rel)}
                          className="inline-flex items-center rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-ink-muted hover:text-ink hover:border-line-strong transition-colors"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => { if (confirm(`Supprimer « ${rel.title} » ?`)) handleDeleteRelease(rel.id); }}
                          disabled={deletingReleaseId === rel.id}
                          className="inline-flex items-center rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-neg hover:border-line-strong disabled:opacity-50 transition-colors"
                        >
                          {deletingReleaseId === rel.id ? <Spinner size="sm" /> : 'Supprimer'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded: track list */}
                    {expandedReleaseId === rel.id && (
                      <div className="border-t border-line px-[22px] py-4 space-y-2.5 bg-surface-2">
                        {rel.tracks.length === 0 && addingTrackReleaseId !== rel.id && (
                          <p className="text-[12.5px] text-ink-faint text-center py-2">Aucun titre — ajoutez-en un</p>
                        )}
                        {rel.tracks.map((t) => (
                          <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface border border-line rounded-[10px]">
                            {t.position !== null && (
                              <span className="text-[11px] font-mono text-ink-faint w-6 text-center shrink-0 roy-num">{t.position}</span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-ink truncate">{t.title}</p>
                              {t.isrc && (
                                <p className="text-[10.5px] font-mono text-ink-faint mt-0.5">ISRC {t.isrc}</p>
                              )}
                            </div>
                            <button
                              onClick={() => { if (confirm(`Supprimer « ${t.title} » ?`)) handleDeleteTrack(rel.id, t.id); }}
                              className="p-1.5 text-ink-faint hover:text-neg transition-colors"
                              aria-label="Supprimer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}

                        {/* Add track inline */}
                        {addingTrackReleaseId === rel.id ? (
                          <div className="bg-accent-soft border border-accent/30 rounded-[12px] p-4 space-y-3">
                            <p className="text-[13px] font-semibold text-ink">Nouveau titre</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                type="text"
                                placeholder="Titre *"
                                value={newTrackTitle}
                                onChange={(e) => setNewTrackTitle(e.target.value)}
                                className="h-9 px-3 bg-surface border border-line rounded-[8px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors"
                              />
                              <input
                                type="text"
                                placeholder="ISRC (ex: FR1234567890)"
                                value={newTrackIsrc}
                                onChange={(e) => setNewTrackIsrc(e.target.value.toUpperCase())}
                                className="h-9 px-3 bg-surface border border-line rounded-[8px] text-[13px] text-ink font-mono placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors"
                              />
                              <input
                                type="number"
                                placeholder="N° (position)"
                                value={newTrackPos}
                                onChange={(e) => setNewTrackPos(e.target.value)}
                                className="h-9 px-3 bg-surface border border-line rounded-[8px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors"
                              />
                            </div>
                            <div className="flex gap-2">
                              <AccentButton
                                onClick={() => handleAddTrack(rel.id)}
                                disabled={savingTrack || !newTrackTitle.trim()}
                              >
                                {savingTrack ? <Spinner size="sm" color="white" /> : 'Ajouter'}
                              </AccentButton>
                              <button
                                onClick={() => { setAddingTrackReleaseId(null); setNewTrackTitle(''); setNewTrackIsrc(''); setNewTrackPos(''); }}
                                className="px-4 py-2 text-[12px] text-ink-muted hover:text-ink transition-colors"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAddingTrackReleaseId(rel.id); setNewTrackTitle(''); setNewTrackIsrc(''); setNewTrackPos(''); }}
                            className="flex items-center gap-1.5 text-[12.5px] text-accent hover:opacity-80 font-semibold transition-opacity"
                          >
                            <IconPlus size={14} />
                            Ajouter un titre
                          </button>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Release Form Modal */}
      {showReleaseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setShowReleaseForm(false)} />
          <div className="relative bg-surface border border-line rounded-[16px] shadow-roy w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-line flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-ink">{editingRelease ? 'Modifier album' : 'Nouvel album'}</h2>
              <button onClick={() => setShowReleaseForm(false)} className="p-2 -mr-2 text-ink-faint hover:text-ink transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelClass}>Titre *</label>
                <input
                  type="text"
                  value={releaseForm.title}
                  onChange={(e) => setReleaseForm({ ...releaseForm, title: e.target.value })}
                  placeholder="Nom de l'album / EP / single"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>UPC</label>
                  <input
                    type="text"
                    value={releaseForm.upc}
                    onChange={(e) => setReleaseForm({ ...releaseForm, upc: e.target.value })}
                    placeholder="0012345678901"
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Format</label>
                  <select
                    value={releaseForm.format}
                    onChange={(e) => setReleaseForm({ ...releaseForm, format: e.target.value })}
                    className={inputClass}
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
                  <label className={labelClass}>Artiste</label>
                  <select
                    value={releaseForm.artist_id}
                    onChange={(e) => setReleaseForm({ ...releaseForm, artist_id: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Aucun / compilation</option>
                    {managedArtists.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Date de sortie</label>
                  <input
                    type="date"
                    value={releaseForm.release_date}
                    onChange={(e) => setReleaseForm({ ...releaseForm, release_date: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  value={releaseForm.notes}
                  onChange={(e) => setReleaseForm({ ...releaseForm, notes: e.target.value })}
                  placeholder="Notes internes…"
                  rows={2}
                  className="w-full px-3 py-2 bg-surface border border-line rounded-[10px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-line flex justify-end gap-3 bg-surface-2">
              <OutlineButton onClick={() => setShowReleaseForm(false)}>Annuler</OutlineButton>
              <AccentButton
                onClick={handleSaveRelease}
                disabled={savingRelease || !releaseForm.title.trim()}
              >
                {savingRelease ? <Spinner size="sm" color="white" /> : (editingRelease ? 'Enregistrer' : 'Créer')}
              </AccentButton>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {linkingTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => setLinkingTrack(null)}
          />
          <div className="relative bg-surface border border-line rounded-[16px] shadow-roy max-w-md w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-line flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-ink">Lier artistes au track</h2>
              <button onClick={() => setLinkingTrack(null)} className="p-2 -mr-2 text-ink-faint hover:text-ink transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto max-h-[60vh] space-y-5">
              <div className="bg-surface-2 rounded-[12px] p-4">
                <p className="text-[13.5px] font-semibold text-ink">{linkingTrack.track_title}</p>
                <p className="text-[12.5px] text-ink-muted mt-0.5">{linkingTrack.original_artist_name}</p>
                <p className="text-[11px] text-ink-faint font-mono mt-1">ISRC {linkingTrack.isrc}</p>
              </div>

              <div className="bg-accent-soft border border-accent/30 rounded-[12px] p-4">
                <p className="text-[11.5px] text-accent-ink">
                  Les % représentent la répartition du <strong>revenu brut</strong> entre les artistes. Le contrat de chaque artiste s&apos;applique ensuite.
                </p>
              </div>

              {/* Selected artists with shares */}
              {linkShares.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[13px] font-semibold text-ink">Répartition du brut:</p>
                  {linkShares.map((share) => (
                    <div key={share.artist_id} className="flex items-center gap-3 bg-surface-2 rounded-[12px] p-4">
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-ink">{getArtistName(share.artist_id)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={Math.round(share.share_percent * 100)}
                          onChange={(e) => updateShare(share.artist_id, parseInt(e.target.value) / 100)}
                          className="w-16 px-3 py-2 border border-line rounded-[10px] text-center text-[13px] text-ink bg-surface focus:outline-none focus:border-line-strong transition-colors roy-num"
                        />
                        <span className="text-[13px] text-ink-faint">%</span>
                        <button
                          onClick={() => removeArtistFromLink(share.artist_id)}
                          className="p-2 text-ink-faint hover:text-neg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className={`text-[13px] font-semibold roy-num ${
                    Math.abs(linkShares.reduce((sum, s) => sum + s.share_percent, 0) - 1) < 0.01
                      ? 'text-accent'
                      : 'text-neg'
                  }`}>
                    Total: {Math.round(linkShares.reduce((sum, s) => sum + s.share_percent, 0) * 100)}%
                    {Math.abs(linkShares.reduce((sum, s) => sum + s.share_percent, 0) - 1) >= 0.01 && ' (doit être 100%)'}
                  </p>
                </div>
              )}

              {/* Add artist */}
              <div>
                <p className="text-[13px] font-semibold text-ink mb-2">Ajouter un artiste:</p>
                <select
                  onChange={(e) => {
                    if (e.target.value) addArtistToLink(e.target.value);
                    e.target.value = '';
                  }}
                  className="w-full h-12 px-4 border border-line bg-surface rounded-[10px] text-[13px] text-ink focus:outline-none focus:border-line-strong transition-colors"
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
            <div className="px-6 py-4 border-t border-line flex gap-3 bg-surface-2">
              <OutlineButton onClick={() => setLinkingTrack(null)} className="flex-1 justify-center">
                Annuler
              </OutlineButton>
              <AccentButton
                onClick={handleSaveLinks}
                disabled={savingLink || linkShares.length === 0 || Math.abs(linkShares.reduce((sum, s) => sum + s.share_percent, 0) - 1) >= 0.01}
                className="flex-1"
              >
                {savingLink && <Spinner size="sm" color="white" />}
                Enregistrer
              </AccentButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
