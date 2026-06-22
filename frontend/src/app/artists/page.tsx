'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Spinner } from '@heroui/react';
import { Artist, ArtistCategory } from '@/lib/types';
import { getArtists, getArtistsSummary, ArtistSummary, getCatalogArtists, CatalogArtist, createArtist, getDuplicateArtists, mergeArtists, SimilarArtistGroup } from '@/lib/api';
import { formatNumber } from '@/lib/formatters';
import { Card, Eyebrow, Pill, Avatar, AccentButton, OutlineButton } from '@/components/roy/ui';
import { IconPlus, IconBox, IconCheck } from '@/components/roy/icons';

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [summaries, setSummaries] = useState<ArtistSummary[]>([]);
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
      const [artistsData, duplicatesData, summaryData] = await Promise.all([
        getArtists(),
        getDuplicateArtists(),
        getArtistsSummary().catch(() => [] as ArtistSummary[]),
      ]);
      setArtists(artistsData);
      setSummaries(summaryData);
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

  const summaryById = useMemo(() => {
    const m = new Map<string, ArtistSummary>();
    summaries.forEach((s) => m.set(s.id, s));
    return m;
  }, [summaries]);

  const filteredArtists = useMemo(() => artists.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    const ga = parseFloat(summaryById.get(a.id)?.total_gross || '0');
    const gb = parseFloat(summaryById.get(b.id)?.total_gross || '0');
    return gb - ga;
  }), [artists, searchQuery, categoryFilter, summaryById]);

  const signedCount = useMemo(() => artists.filter(a => a.category === 'signed').length, [artists]);
  const collaboratorCount = useMemo(() => artists.filter(a => a.category === 'collaborator').length, [artists]);

  const inactiveCatalog = useMemo(() => catalogArtists.filter(ca =>
    !artists.some(a => a.name.toLowerCase() === ca.artist_name.toLowerCase())
  ).filter(ca =>
    ca.artist_name.toLowerCase().includes(searchQuery.toLowerCase())
  ), [catalogArtists, artists, searchQuery]);

  const categoryLabel = (cat: ArtistCategory) => (cat === 'signed' ? 'Signé' : 'Collaborateur');

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div>
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Artistes</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">{artists.length} artiste{artists.length > 1 ? 's' : ''} · {signedCount} signé{signedCount > 1 ? 's' : ''} · {collaboratorCount} collab{collaboratorCount > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher un artiste…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-[38px] w-full sm:w-[240px] pl-9 pr-3 rounded-[10px] border border-line bg-surface text-[12.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors"
            />
          </div>
          {!showCatalog && (
            <OutlineButton onClick={loadCatalog}>
              {loadingCatalog ? <Spinner size="sm" /> : <IconBox size={14} />}
              Catalogue
            </OutlineButton>
          )}
          <AccentButton onClick={loadCatalog} disabled={loadingCatalog}>
            <IconPlus size={14} /> Nouvel artiste
          </AccentButton>
        </div>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {/* Error */}
        {error && (
          <div className="bg-surface border border-line rounded-[16px] px-4 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-neg flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-neg text-[12.5px]">{error}</p>
          </div>
        )}

        {/* Category filter tabs */}
        <div className="flex gap-1 rounded-[11px] border border-line bg-surface p-1 w-fit">
          {[
            { key: 'all', label: `Tous (${artists.length})` },
            { key: 'signed', label: `Signés (${signedCount})` },
            { key: 'collaborator', label: `Collabs (${collaboratorCount})` },
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategoryFilter(cat.key as ArtistCategory | 'all')}
              className={`px-4 py-1.5 rounded-lg text-[12.5px] transition-colors ${
                categoryFilter === cat.key
                  ? 'bg-accent-soft text-accent font-semibold'
                  : 'text-ink-muted hover:text-ink font-medium'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Duplicates Warning */}
        {duplicates.length > 0 && showDuplicates && (
          <Card padded={false} className="overflow-hidden">
            <div className="px-[22px] py-4 border-b border-line flex items-center justify-between">
              <div>
                <div className="text-[13.5px] font-semibold text-ink">Doublons détectés</div>
                <div className="text-[11.5px] text-ink-faint mt-0.5">{duplicates.length} groupe(s) à vérifier</div>
              </div>
              <button
                onClick={() => setShowDuplicates(false)}
                className="text-ink-faint hover:text-ink p-1"
                aria-label="Fermer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div>
              {duplicates.map((group, idx) => (
                <div key={idx} className="px-[22px] py-4 border-b border-line last:border-0">
                  <p className="text-[12px] text-ink-faint mb-3">Ces artistes ont des noms similaires :</p>
                  <div className="space-y-2">
                    {group.artists.map((artist) => (
                      <div key={artist.id} className="flex items-center justify-between rounded-[12px] bg-surface-2 px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={artist.name} src={artist.image_url_small || artist.image_url} size={34} />
                          <div>
                            <p className="text-[13px] font-semibold text-ink">{artist.name}</p>
                            <p className="text-[11px] text-ink-faint">{artist.spotify_id ? 'Spotify lié' : 'Pas de Spotify'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {group.artists.filter(a => a.id !== artist.id).map((other) => (
                            <button
                              key={other.id}
                              onClick={() => setMergingPair({ source: other, target: artist })}
                              className="rounded-[8px] bg-surface border border-line px-3 py-1.5 text-[11px] font-semibold text-ink hover:bg-surface-2 transition-colors"
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
          </Card>
        )}

        {/* Merge Confirmation */}
        {mergingPair && (
          <Card>
            <div className="text-[13.5px] font-semibold text-ink mb-2">Confirmer la fusion</div>
            <p className="text-[12.5px] text-ink-muted mb-4">
              Fusionner <strong className="text-ink">&quot;{mergingPair.source.name}&quot;</strong> vers <strong className="text-ink">&quot;{mergingPair.target.name}&quot;</strong>
            </p>
            <div className="rounded-[12px] bg-surface-2 px-4 py-3 text-[12px] space-y-1.5 mb-4 text-ink-muted">
              <p>• Toutes les transactions seront transférées</p>
              <p>• Les avances et contrats seront fusionnés</p>
              <p>• L&apos;artiste source sera supprimé</p>
            </div>
            <div className="flex gap-2.5 justify-end">
              <OutlineButton onClick={() => { if (!merging) setMergingPair(null); }}>
                Annuler
              </OutlineButton>
              <AccentButton onClick={handleMerge} disabled={merging}>
                {merging && <Spinner size="sm" />}
                Confirmer
              </AccentButton>
            </div>
          </Card>
        )}

        {loading ? (
          <Card className="flex flex-col items-center justify-center py-16">
            <Spinner size="lg" />
            <p className="text-ink-faint text-[12.5px] mt-4">Chargement des artistes…</p>
          </Card>
        ) : (
          <>
            {/* Active Artists table */}
            <Card padded={false} className="overflow-hidden">
              {filteredArtists.length === 0 ? (
                <div className="px-[22px] py-16 text-center">
                  <p className="text-ink-faint text-[13px]">{searchQuery ? 'Aucun artiste trouvé' : 'Aucun artiste activé'}</p>
                  {!showCatalog && !searchQuery && (
                    <div className="mt-4 flex justify-center">
                      <OutlineButton onClick={loadCatalog}>
                        <IconBox size={14} /> Activer depuis le catalogue
                      </OutlineButton>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Header row */}
                  <div className="grid grid-cols-[2fr_1fr_1.1fr_1fr_0.9fr] px-[22px] py-3 border-b border-line">
                    <Eyebrow className="text-[10px]">Artiste</Eyebrow>
                    <Eyebrow className="text-[10px]">Catégorie</Eyebrow>
                    <Eyebrow className="text-[10px] text-right">Revenus</Eyebrow>
                    <Eyebrow className="text-[10px] text-right">Streams</Eyebrow>
                    <Eyebrow className="text-[10px] text-center">Contrat</Eyebrow>
                  </div>
                  {filteredArtists.map((artist, i) => {
                    const signed = artist.category === 'signed';
                    const summary = summaryById.get(artist.id);
                    return (
                      <Link
                        key={artist.id}
                        href={`/artists/${artist.id}`}
                        className="grid grid-cols-[2fr_1fr_1.1fr_1fr_0.9fr] items-center px-[22px] py-3.5 border-b border-line last:border-0 hover:bg-surface-2 transition-colors"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={artist.name} src={artist.image_url_small || artist.image_url} size={34} accent={i === 0} />
                          <span className="text-[13.5px] font-semibold text-ink truncate">{artist.name}</span>
                        </span>
                        <span className="text-[12.5px] text-ink-muted">{categoryLabel(artist.category)}</span>
                        <span className="text-right roy-num text-[13px] font-bold text-ink">{summary ? formatCurrency(summary.total_gross) : '—'}</span>
                        <span className="text-right roy-num text-[13px] text-ink-muted">{summary ? formatNumber(summary.total_streams) : '—'}</span>
                        <span className="flex justify-center">
                          <Pill tone={signed ? 'accent' : 'neutral'}>{signed ? 'Actif' : 'Collab'}</Pill>
                        </span>
                      </Link>
                    );
                  })}
                </>
              )}
            </Card>

            {/* Catalog */}
            {showCatalog && (
              <Card padded={false} className="overflow-hidden">
                <div className="px-[22px] py-4 border-b border-line flex items-center justify-between">
                  <div>
                    <div className="text-[13.5px] font-semibold text-ink">À activer</div>
                    <div className="text-[11.5px] text-ink-faint mt-0.5">{inactiveCatalog.length} artiste(s) du catalogue</div>
                  </div>
                  <button
                    onClick={() => setShowCatalog(false)}
                    className="text-ink-faint hover:text-ink p-1"
                    aria-label="Fermer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {loadingCatalog ? (
                  <div className="px-[22px] py-16 text-center">
                    <Spinner size="md" />
                    <p className="text-ink-faint text-[12.5px] mt-3">Chargement du catalogue…</p>
                  </div>
                ) : inactiveCatalog.length === 0 ? (
                  <div className="px-[22px] py-16 text-center">
                    <p className="text-ink-faint text-[13px]">{searchQuery ? 'Aucun artiste trouvé' : 'Tous les artistes sont activés'}</p>
                  </div>
                ) : (
                  <>
                    {/* Header row */}
                    <div className="grid grid-cols-[2fr_1fr_1.1fr_1fr_0.9fr] px-[22px] py-3 border-b border-line">
                      <Eyebrow className="text-[10px]">Artiste</Eyebrow>
                      <Eyebrow className="text-[10px]">Releases</Eyebrow>
                      <Eyebrow className="text-[10px] text-right">Revenus</Eyebrow>
                      <Eyebrow className="text-[10px] text-right">Streams</Eyebrow>
                      <Eyebrow className="text-[10px] text-center">Action</Eyebrow>
                    </div>
                    <div className="max-h-[480px] overflow-y-auto">
                      {inactiveCatalog.slice(0, 50).map((ca) => (
                        <div key={ca.artist_name} className="grid grid-cols-[2fr_1fr_1.1fr_1fr_0.9fr] items-center px-[22px] py-3.5 border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Avatar name={ca.artist_name} size={34} />
                            <span className="text-[13.5px] font-semibold text-ink truncate">{ca.artist_name}</span>
                          </span>
                          <span className="text-[12.5px] text-ink-muted">{formatNumber(ca.release_count)}</span>
                          <span className="text-right roy-num text-[13px] font-bold text-ink">{formatCurrency(ca.total_gross, ca.currency)}</span>
                          <span className="text-right roy-num text-[13px] text-ink-muted">{formatNumber(ca.total_streams)}</span>
                          <span className="flex justify-center">
                            <button
                              onClick={() => handleActivate(ca.artist_name)}
                              disabled={!!activating}
                              className="inline-flex items-center gap-1.5 rounded-[8px] bg-accent-soft px-3 py-1.5 text-[11px] font-semibold text-accent hover:opacity-90 disabled:opacity-50 transition-opacity"
                            >
                              {activating === ca.artist_name ? <Spinner size="sm" /> : <IconCheck size={12} />}
                              Activer
                            </button>
                          </span>
                        </div>
                      ))}
                      {inactiveCatalog.length > 50 && (
                        <div className="px-[22px] py-3 text-center text-ink-faint text-[12px]">
                          +{inactiveCatalog.length - 50} autres artistes
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
