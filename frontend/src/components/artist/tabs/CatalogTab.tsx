'use client';

import { useState, useEffect, useCallback } from 'react';
import { Spinner } from '@heroui/react';
import { Artist, Contract } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import { Card, Pill, AccentButton, OutlineButton } from '@/components/roy/ui';
import { IconDownload, IconMusic } from '@/components/roy/icons';
import {
  getContracts,
  getArtistReleases,
  getArtistTracks,
  searchAlbumByUPC,
  searchTrackByISRC,
  getCachedReleaseArtworks,
  getCachedTrackArtworks,
  mergeRelease,
  linkUpcToRelease,
  CatalogRelease,
  CatalogTrack,
  SpotifyAlbumResult,
  SpotifyTrackResult,
} from '@/lib/api';

function getContractShares(contract: Contract, forArtistId?: string): { artistShare: number; labelShare: number } {
  if (!contract.parties || contract.parties.length === 0) {
    return { artistShare: parseFloat(contract.artist_share || '0'), labelShare: parseFloat(contract.label_share || '0') };
  }
  let artistShare: number;
  if (forArtistId) {
    const thisParty = contract.parties.find(p => p.party_type === 'artist' && p.artist_id === forArtistId);
    artistShare = thisParty ? parseFloat(thisParty.share_percentage || '0') : 0;
  } else {
    artistShare = contract.parties.filter(p => p.party_type === 'artist').reduce((sum, p) => sum + parseFloat(p.share_percentage || '0'), 0);
  }
  const labelShare = contract.parties.filter(p => p.party_type === 'label').reduce((sum, p) => sum + parseFloat(p.share_percentage || '0'), 0);
  return { artistShare, labelShare };
}

const formatPercent = (decimal: number) => {
  const pct = decimal * 100;
  return pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2).replace(/0+$/, '');
};

interface CatalogTabProps {
  artist: Artist;
  artistId: string;
}

export default function CatalogTab({ artist, artistId }: CatalogTabProps) {
  const [releases, setReleases] = useState<CatalogRelease[]>([]);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [albumArtwork, setAlbumArtwork] = useState<Record<string, SpotifyAlbumResult>>({});
  const [trackArtwork, setTrackArtwork] = useState<Record<string, SpotifyTrackResult>>({});
  const [loadingArtwork, setLoadingArtwork] = useState<Record<string, boolean>>({});
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Merge release modal
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourceRelease, setMergeSourceRelease] = useState<{ title: string; upc: string } | null>(null);
  const [mergeTargetUpc, setMergeTargetUpc] = useState('');
  const [mergingRelease, setMergingRelease] = useState(false);

  const loadData = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const [contractsData] = await Promise.all([getContracts(artistId)]);
      setContracts(contractsData);

      if (artist.name) {
        const [releasesData, tracksData] = await Promise.all([getArtistReleases(artist.name), getArtistTracks(artist.name)]);
        setReleases(releasesData);
        setTracks(tracksData);

        // Load cached artworks
        const releaseUpcs = releasesData.map(r => r.upc).filter(Boolean);
        const trackIsrcs = tracksData.map(t => t.isrc).filter(Boolean);
        const [cachedReleaseArt, cachedTrackArt] = await Promise.all([getCachedReleaseArtworks(releaseUpcs).catch(() => []), getCachedTrackArtworks(trackIsrcs).catch(() => [])]);
        const albumArtMap: Record<string, SpotifyAlbumResult> = {};
        for (const art of cachedReleaseArt) { if (art.upc && art.image_url) albumArtMap[art.upc] = { spotify_id: art.spotify_id, name: art.name, image_url: art.image_url, image_url_small: art.image_url_small }; }
        setAlbumArtwork(albumArtMap);
        const trackArtMap: Record<string, SpotifyTrackResult> = {};
        for (const art of cachedTrackArt) { if (art.isrc && art.image_url) trackArtMap[art.isrc] = { spotify_id: art.spotify_id, name: art.name, album_name: art.album_name, image_url: art.image_url, image_url_small: art.image_url_small }; }
        setTrackArtwork(trackArtMap);

        // Fetch missing artwork for first 5 releases
        const missingReleases = releasesData.filter(r => r.upc && !albumArtMap[r.upc]).slice(0, 5);
        for (const release of missingReleases) { try { const artworkResult = await searchAlbumByUPC(release.upc); if (artworkResult.image_url) setAlbumArtwork(prev => ({ ...prev, [release.upc]: artworkResult })); } catch { /* optional */ } }
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); } finally { setLoadingCatalog(false); }
  }, [artistId, artist.name]);

  useEffect(() => { loadData(); }, [loadData]);

  const fetchAlbumArtwork = async (upc: string) => {
    if (albumArtwork[upc] || loadingArtwork[`album-${upc}`]) return;
    setLoadingArtwork(prev => ({ ...prev, [`album-${upc}`]: true }));
    try { const result = await searchAlbumByUPC(upc); if (result.image_url) setAlbumArtwork(prev => ({ ...prev, [upc]: result })); } catch { /* optional */ } finally { setLoadingArtwork(prev => ({ ...prev, [`album-${upc}`]: false })); }
  };

  const fetchTrackArtwork = async (isrc: string) => {
    if (trackArtwork[isrc] || loadingArtwork[`track-${isrc}`]) return;
    setLoadingArtwork(prev => ({ ...prev, [`track-${isrc}`]: true }));
    try { const result = await searchTrackByISRC(isrc); if (result.image_url) setTrackArtwork(prev => ({ ...prev, [isrc]: result })); } catch { /* optional */ } finally { setLoadingArtwork(prev => ({ ...prev, [`track-${isrc}`]: false })); }
  };

  const fetchAllArtwork = async () => {
    const releasesToFetch = releases.slice(0, 10);
    for (const release of releasesToFetch) { if (!albumArtwork[release.upc]) await fetchAlbumArtwork(release.upc); }
  };

  const toggleReleaseExpanded = (key: string) => { setExpandedReleases(prev => { const s = new Set(prev); if (s.has(key)) s.delete(key); else s.add(key); return s; }); };
  const getContractForRelease = (upc: string) => contracts.find(c => c.scope === 'release' && c.scope_id === upc);
  const getContractForTrack = (isrc: string) => contracts.find(c => c.scope === 'track' && c.scope_id === isrc);
  const catalogContract = contracts.find(c => c.scope === 'catalog');
  const formatNumber = (value: number) => value.toLocaleString('fr-FR');

  const handleMergeRelease = async () => {
    if (!mergeSourceRelease || !mergeTargetUpc || !artist) return;
    setMergingRelease(true);
    try {
      if (mergeSourceRelease.upc === 'UNKNOWN' || !mergeSourceRelease.upc) await linkUpcToRelease(artist.name, mergeSourceRelease.title, mergeTargetUpc);
      else await mergeRelease(artist.name, mergeSourceRelease.upc, mergeTargetUpc);
      setShowMergeModal(false); setMergeSourceRelease(null); setMergeTargetUpc(''); loadData();
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur de fusion'); } finally { setMergingRelease(false); }
  };

  const groupedReleasesArray = releases.map((release) => ({ key: release.upc || release.release_title, release_title: release.release_title, upc: release.upc, currency: release.currency, total_gross: release.total_gross, total_streams: release.total_streams, track_count: release.track_count, sources: release.sources || [] }));

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[13px] text-neg">
          {error}<button onClick={() => setError(null)} className="ml-2 underline">Fermer</button>
        </div>
      )}

      {/* Releases */}
      <Card padded={false} className="overflow-hidden">
        <div className="px-[22px] py-4 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-[13.5px] font-semibold text-ink">Releases ({groupedReleasesArray.length})</h2>
            <p className="text-[11.5px] text-ink-faint mt-0.5">% spécifique par album / EP / single</p>
          </div>
          {releases.length > 0 && Object.keys(albumArtwork).length < releases.length && (
            <OutlineButton onClick={fetchAllArtwork}>
              <IconDownload size={14} /> Charger images
            </OutlineButton>
          )}
        </div>
        {loadingCatalog ? (
          <div className="px-4 py-10 text-center"><Spinner size="md" /></div>
        ) : releases.length === 0 ? (
          <p className="px-4 py-8 text-center text-ink-faint text-[13px]">Aucune release trouvée</p>
        ) : (
          <div className="divide-y divide-line">
            {groupedReleasesArray.map((group) => {
              const contract = getContractForRelease(group.upc);
              const artwork = albumArtwork[group.upc];
              const isLoadingArt = loadingArtwork[`album-${group.upc}`];
              const isExpanded = expandedReleases.has(group.key);
              const hasMultipleSources = group.sources.length > 1;
              return (
                <div key={group.key}>
                  <div className="px-[22px] py-3">
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        {artwork?.image_url_small ? (
                          <img src={artwork.image_url_small} alt={group.release_title} className="w-12 h-12 rounded-[12px] object-cover" />
                        ) : (
                          <button onClick={() => fetchAlbumArtwork(group.upc)} disabled={isLoadingArt} className="w-12 h-12 rounded-[12px] bg-surface-2 flex items-center justify-center hover:bg-surface-2/70 transition-colors text-ink-faint">
                            {isLoadingArt ? (<div className="w-4 h-4 border-2 border-ink-faint border-t-transparent rounded-full animate-spin" />) : (<IconMusic size={18} />)}
                          </button>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <button onClick={() => toggleReleaseExpanded(group.key)} className="text-left w-full group">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${contract ? 'bg-accent' : catalogContract ? 'bg-amber-400' : 'bg-ink-faint'}`} />
                            <p className={`text-[13.5px] font-semibold truncate group-hover:text-accent transition-colors ${group.release_title === '(Sans album)' ? 'text-ink-faint italic' : 'text-ink'}`}>{group.release_title === '(Sans album)' ? 'Sans titre' : group.release_title}</p>
                            {hasMultipleSources && (<svg className={`w-4 h-4 text-ink-faint transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>)}
                          </div>
                        </button>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {group.upc && group.upc !== 'UNKNOWN' && (<p className="text-[10.5px] text-ink-faint font-mono">UPC {group.upc}</p>)}
                          {group.sources.length > 0 && (<div className="flex flex-wrap items-center gap-1">{group.sources.map((s, si) => (<span key={si} className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-surface-2 text-ink-muted">{s.store_name}{s.physical_format ? ` (${s.physical_format})` : ''}</span>))}</div>)}
                        </div>
                        <p className="text-[12.5px] text-ink-muted mt-0.5">{group.track_count} track{group.track_count > 1 ? 's' : ''} · <span className="roy-num">{formatCurrency(group.total_gross, group.currency)}</span>{group.total_streams > 0 && (<span className="text-ink-faint ml-1 roy-num">· {group.total_streams.toLocaleString()} stream{group.total_streams > 1 ? 's' : ''}</span>)}{hasMultipleSources && (<span className="text-ink-faint ml-1">· {group.sources.length} source{group.sources.length > 1 ? 's' : ''}</span>)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {contract ? (
                          <Pill tone="accent">{formatPercent(getContractShares(contract, artistId).artistShare)}%</Pill>
                        ) : catalogContract ? (
                          <Pill tone="neutral">{formatPercent(getContractShares(catalogContract, artistId).artistShare)}% (défaut)</Pill>
                        ) : (
                          <>{group.upc === 'UNKNOWN' && (
                            <button onClick={() => { setMergeSourceRelease({ title: group.release_title, upc: group.upc }); setMergeTargetUpc(''); setShowMergeModal(true); }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-surface-2 text-ink-muted hover:text-ink transition-colors">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                              Fusionner
                            </button>
                          )}</>
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded && hasMultipleSources && (
                    <div className="bg-surface-2 border-t border-line px-[22px] py-2">
                      <div className="pl-3 border-l-2 border-line space-y-2">
                        {group.sources.map((source, sIdx) => {
                          const isPhysical = source.store_name?.toLowerCase() === 'bandcamp' || source.store_name?.toLowerCase() === 'squarespace';
                          const unitLabel = isPhysical ? 'vente' : 'stream';
                          return (
                            <div key={`${source.store_name}-${source.physical_format}-${sIdx}`} className="flex items-center gap-3 py-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">{source.store_name && (<span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] bg-surface text-ink-muted border border-line">{source.store_name}</span>)}{source.physical_format && (<span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface text-ink-muted border border-line font-semibold text-[11px]">{source.physical_format}</span>)}</div>
                                <p className="text-[11px] text-ink-faint mt-1">{source.track_count} track{source.track_count > 1 ? 's' : ''}</p>
                              </div>
                              <div className="text-right"><p className="text-[12.5px] font-semibold text-ink roy-num">{formatCurrency(source.gross, group.currency)}</p>{source.quantity > 0 && (<p className="text-[11px] text-ink-faint roy-num">{formatNumber(source.quantity)} {unitLabel}{source.quantity > 1 ? 's' : ''}</p>)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Tracks */}
      <Card padded={false} className="overflow-hidden">
        <div className="px-[22px] py-4 border-b border-line">
          <h2 className="text-[13.5px] font-semibold text-ink">Tracks ({tracks.length})</h2>
          <p className="text-[11.5px] text-ink-faint mt-0.5">% spécifique par track (optionnel)</p>
        </div>
        {loadingCatalog ? (
          <div className="px-4 py-10 text-center"><Spinner size="md" /></div>
        ) : tracks.length === 0 ? (
          <p className="px-4 py-8 text-center text-ink-faint text-[13px]">Aucune track trouvée</p>
        ) : (
          <div className="divide-y divide-line max-h-96 overflow-y-auto">
            {tracks.map((track, index) => {
              const trackContract = getContractForTrack(track.isrc);
              const releaseContract = releases.find(r => r.release_title === track.release_title) ? getContractForRelease(releases.find(r => r.release_title === track.release_title)!.upc) : null;
              const effectiveContract = trackContract || releaseContract || catalogContract;
              const isSpecific = !!trackContract;
              const isReleaseLevel = !trackContract && !!releaseContract;
              const artwork = trackArtwork[track.isrc];
              const isLoadingArt = loadingArtwork[`track-${track.isrc}`];
              return (
                <div key={`${track.isrc}-${index}`} className="px-[22px] py-3">
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      {artwork?.image_url_small ? (
                        <img src={artwork.image_url_small} alt={track.track_title} className="w-10 h-10 rounded-[10px] object-cover" />
                      ) : (
                        <button onClick={() => fetchTrackArtwork(track.isrc)} disabled={isLoadingArt} className="w-10 h-10 rounded-[10px] bg-surface-2 flex items-center justify-center hover:bg-surface-2/70 transition-colors text-ink-faint">
                          {isLoadingArt ? (<div className="w-3 h-3 border-2 border-ink-faint border-t-transparent rounded-full animate-spin" />) : (<IconMusic size={15} />)}
                        </button>
                      )}
                    </div>
                    <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-ink truncate">{track.track_title}</p><p className="text-[12.5px] text-ink-muted truncate">{track.release_title}</p><p className="text-[10.5px] text-ink-faint font-mono">ISRC {track.isrc}</p></div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isSpecific && trackContract ? (
                        <Pill tone="accent">{formatPercent(getContractShares(trackContract, artistId).artistShare)}%</Pill>
                      ) : effectiveContract ? (
                        <Pill tone={isReleaseLevel ? 'accent' : 'neutral'}>{formatPercent(getContractShares(effectiveContract, artistId).artistShare)}%{isReleaseLevel ? ' (release)' : ' (défaut)'}</Pill>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Merge Release Modal */}
      {showMergeModal && mergeSourceRelease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => { setShowMergeModal(false); setMergeSourceRelease(null); }} />
          <div className="relative bg-surface border border-line rounded-[16px] shadow-roy max-w-md w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-line flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-ink">Fusionner la release</h2>
              <button onClick={() => { setShowMergeModal(false); setMergeSourceRelease(null); }} className="p-2 text-ink-faint hover:text-ink transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-[12px] bg-surface-2 p-3"><p className="text-[12px] text-ink-faint">Release source</p><p className="text-[13.5px] font-semibold text-ink">{mergeSourceRelease.title}</p>{mergeSourceRelease.upc !== 'UNKNOWN' && (<p className="text-[11px] text-ink-faint font-mono mt-1">UPC {mergeSourceRelease.upc}</p>)}</div>
              <div>
                <label className="roy-eyebrow text-[9.5px] mb-1.5 block">Fusionner vers (UPC cible)</label>
                <select value={mergeTargetUpc} onChange={(e) => setMergeTargetUpc(e.target.value)} className="w-full h-12 px-4 bg-surface border border-line rounded-[10px] text-[14px] text-ink focus:outline-none focus:border-line-strong transition-colors">
                  <option value="">Sélectionner une release...</option>
                  {releases.filter(r => r.upc !== mergeSourceRelease.upc && r.upc !== 'UNKNOWN').map(r => (<option key={r.upc} value={r.upc}>{r.release_title} (UPC: {r.upc})</option>))}
                </select>
              </div>
              <div className="rounded-[12px] bg-surface-2 p-3"><p className="text-[12px] text-ink-muted">Toutes les transactions de &quot;{mergeSourceRelease.title}&quot; seront rattachées à la release cible. Cette action est irréversible.</p></div>
            </div>
            <div className="px-6 py-4 border-t border-line flex gap-3 bg-surface-2">
              <OutlineButton onClick={() => { setShowMergeModal(false); setMergeSourceRelease(null); }} className="flex-1 justify-center">Annuler</OutlineButton>
              <AccentButton onClick={handleMergeRelease} disabled={mergingRelease || !mergeTargetUpc} className="flex-1">
                {mergingRelease && <div className="w-3.5 h-3.5 border-2 border-accent-ink border-t-transparent rounded-full animate-spin" />}
                Fusionner
              </AccentButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
