'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import { Artist, Contract } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
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
  const getTracksForRelease = (releaseTitle: string) => tracks.filter(t => t.release_title === releaseTitle);
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
    <div className="space-y-6">
      {error && (<div className="bg-danger-50 text-danger px-4 py-3 rounded-xl text-sm">{error}<button onClick={() => setError(null)} className="ml-2 underline">Fermer</button></div>)}

      {/* Releases */}
      <div className="bg-background rounded-2xl border border-divider shadow-sm">
        <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
          <div><h2 className="font-medium text-foreground">Releases ({groupedReleasesArray.length})</h2><p className="text-sm text-secondary-500">% spécifique par album/EP/single</p></div>
          {releases.length > 0 && Object.keys(albumArtwork).length < releases.length && (<button onClick={fetchAllArtwork} className="text-sm text-success hover:text-success-700 inline-flex items-center gap-1"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" /></svg>Charger images</button>)}
        </div>
        {loadingCatalog ? (<div className="px-4 py-8 text-center"><div className="animate-spin w-6 h-6 border-2 border-default-900 border-t-transparent rounded-full mx-auto" /></div>) : releases.length === 0 ? (<p className="px-4 py-6 text-center text-secondary-500">Aucune release trouvée</p>) : (
          <div className="divide-y divide-divider">
            {groupedReleasesArray.map((group) => {
              const contract = getContractForRelease(group.upc);
              const artwork = albumArtwork[group.upc];
              const isLoadingArt = loadingArtwork[`album-${group.upc}`];
              const isExpanded = expandedReleases.has(group.key);
              const hasMultipleSources = group.sources.length > 1;
              return (
                <div key={group.key}>
                  <div className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        {artwork?.image_url_small ? (<img src={artwork.image_url_small} alt={group.release_title} className="w-12 h-12 rounded-md object-cover" />) : (<button onClick={() => fetchAlbumArtwork(group.upc)} disabled={isLoadingArt} className="w-12 h-12 rounded-md bg-content2 flex items-center justify-center hover:bg-content3 transition-colors">{isLoadingArt ? (<div className="w-4 h-4 border-2 border-default-400 border-t-transparent rounded-full animate-spin" />) : (<svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>)}</button>)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <button onClick={() => toggleReleaseExpanded(group.key)} className="text-left w-full group">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${contract ? 'bg-success-500' : catalogContract ? 'bg-warning-400' : 'bg-secondary-300'}`} />
                            <p className={`font-medium truncate group-hover:text-secondary-700 ${group.release_title === '(Sans album)' ? 'text-secondary-400 italic' : 'text-foreground'}`}>{group.release_title === '(Sans album)' ? 'Sans titre' : group.release_title}</p>
                            {hasMultipleSources && (<svg className={`w-4 h-4 text-secondary-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>)}
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          {group.upc && group.upc !== 'UNKNOWN' && (<p className="text-xs text-secondary-400 font-mono">UPC: {group.upc}</p>)}
                          {group.sources.length > 0 && (<div className="flex flex-wrap items-center gap-1">{group.sources.map((s, si) => (<span key={si} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${s.store_name?.toLowerCase() === 'bandcamp' || s.store_name?.toLowerCase() === 'squarespace' ? 'bg-warning/10 text-warning-700' : 'bg-primary/10 text-primary-700'}`}>{s.store_name}{s.physical_format ? ` (${s.physical_format})` : ''}</span>))}</div>)}
                        </div>
                        <p className="text-sm text-secondary-500">{group.track_count} track{group.track_count > 1 ? 's' : ''} · {formatCurrency(group.total_gross, group.currency)}{group.total_streams > 0 && (<span className="text-secondary-400 ml-1">· {group.total_streams.toLocaleString()} stream{group.total_streams > 1 ? 's' : ''}</span>)}{hasMultipleSources && (<span className="text-secondary-400 ml-1">· {group.sources.length} source{group.sources.length > 1 ? 's' : ''}</span>)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {contract ? (<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success-700">{formatPercent(getContractShares(contract, artistId).artistShare)}%</span>) : catalogContract ? (<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-content2 text-secondary-600">{formatPercent(getContractShares(catalogContract, artistId).artistShare)}% (défaut)</span>) : (
                          <>{group.upc === 'UNKNOWN' && (<button onClick={() => { setMergeSourceRelease({ title: group.release_title, upc: group.upc }); setMergeTargetUpc(''); setShowMergeModal(true); }} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning-700 hover:bg-warning/20 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>Fusionner</button>)}</>
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded && hasMultipleSources && (
                    <div className="bg-content2 border-t border-divider px-4 py-2">
                      <div className="ml-15 pl-3 border-l-2 border-divider space-y-2">
                        {group.sources.map((source, sIdx) => {
                          const isPhysical = source.store_name?.toLowerCase() === 'bandcamp' || source.store_name?.toLowerCase() === 'squarespace';
                          const unitLabel = isPhysical ? 'vente' : 'stream';
                          return (
                            <div key={`${source.store_name}-${source.physical_format}-${sIdx}`} className="flex items-center gap-3 py-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">{source.store_name && (<span className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium text-xs ${isPhysical ? 'bg-warning/10 text-warning-700' : 'bg-primary/10 text-primary-700'}`}>{source.store_name}</span>)}{source.physical_format && (<span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary/10 text-secondary-700 font-medium text-xs">{source.physical_format}</span>)}</div>
                                <p className="text-xs text-secondary-400 mt-1">{source.track_count} track{source.track_count > 1 ? 's' : ''}</p>
                              </div>
                              <div className="text-right"><p className="text-sm font-medium text-secondary-700">{formatCurrency(source.gross, group.currency)}</p>{source.quantity > 0 && (<p className="text-xs text-secondary-400">{formatNumber(source.quantity)} {unitLabel}{source.quantity > 1 ? 's' : ''}</p>)}</div>
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
      </div>

      {/* Tracks */}
      <div className="bg-background rounded-2xl border border-divider shadow-sm">
        <div className="px-5 py-4 border-b border-divider"><h2 className="font-medium text-foreground">Tracks ({tracks.length})</h2><p className="text-sm text-secondary-500">% spécifique par track (optionnel)</p></div>
        {loadingCatalog ? (<div className="px-4 py-8 text-center"><div className="animate-spin w-6 h-6 border-2 border-default-900 border-t-transparent rounded-full mx-auto" /></div>) : tracks.length === 0 ? (<p className="px-4 py-6 text-center text-secondary-500">Aucune track trouvée</p>) : (
          <div className="divide-y divide-divider max-h-96 overflow-y-auto">
            {tracks.map((track, index) => {
              const trackContract = getContractForTrack(track.isrc);
              const releaseContract = releases.find(r => r.release_title === track.release_title) ? getContractForRelease(releases.find(r => r.release_title === track.release_title)!.upc) : null;
              const effectiveContract = trackContract || releaseContract || catalogContract;
              const isSpecific = !!trackContract;
              const isReleaseLevel = !trackContract && !!releaseContract;
              const artwork = trackArtwork[track.isrc];
              const isLoadingArt = loadingArtwork[`track-${track.isrc}`];
              return (
                <div key={`${track.isrc}-${index}`} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">{artwork?.image_url_small ? (<img src={artwork.image_url_small} alt={track.track_title} className="w-10 h-10 rounded object-cover" />) : (<button onClick={() => fetchTrackArtwork(track.isrc)} disabled={isLoadingArt} className="w-10 h-10 rounded bg-content2 flex items-center justify-center hover:bg-content3 transition-colors">{isLoadingArt ? (<div className="w-3 h-3 border-2 border-default-400 border-t-transparent rounded-full animate-spin" />) : (<svg className="w-4 h-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>)}</button>)}</div>
                    <div className="min-w-0 flex-1"><p className="font-medium text-foreground truncate">{track.track_title}</p><p className="text-sm text-secondary-500 truncate">{track.release_title}</p><p className="text-xs text-secondary-400 font-mono">ISRC: {track.isrc}</p></div>
                    <div className="flex items-center gap-2">
                      {isSpecific && trackContract ? (<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary-700">{formatPercent(getContractShares(trackContract, artistId).artistShare)}%</span>) : effectiveContract ? (<span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${isReleaseLevel ? 'bg-success/10 text-success-700' : 'bg-content2 text-secondary-600'}`}>{formatPercent(getContractShares(effectiveContract, artistId).artistShare)}%{isReleaseLevel ? ' (release)' : ' (défaut)'}</span>) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Merge Release Modal */}
      {showMergeModal && mergeSourceRelease && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="px-4 py-4 sm:px-6 border-b border-divider"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-foreground">Fusionner la release</h2><button onClick={() => { setShowMergeModal(false); setMergeSourceRelease(null); }} className="p-2 -mr-2 text-secondary-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div></div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="bg-content2 rounded-xl p-3"><p className="text-sm text-secondary-500">Release source</p><p className="font-medium text-foreground">{mergeSourceRelease.title}</p>{mergeSourceRelease.upc !== 'UNKNOWN' && (<p className="text-xs text-secondary-400 font-mono mt-1">UPC: {mergeSourceRelease.upc}</p>)}</div>
              <div><label className="block text-sm font-medium text-secondary-700 mb-2">Fusionner vers (UPC cible)</label><select value={mergeTargetUpc} onChange={(e) => setMergeTargetUpc(e.target.value)} className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm"><option value="">Sélectionner une release...</option>{releases.filter(r => r.upc !== mergeSourceRelease.upc && r.upc !== 'UNKNOWN').map(r => (<option key={r.upc} value={r.upc}>{r.release_title} (UPC: {r.upc})</option>))}</select></div>
              <div className="bg-warning/5 rounded-xl p-3"><p className="text-xs text-warning-700">Toutes les transactions de &quot;{mergeSourceRelease.title}&quot; seront rattachées à la release cible. Cette action est irréversible.</p></div>
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3"><Button variant="secondary" onClick={() => { setShowMergeModal(false); setMergeSourceRelease(null); }} className="flex-1">Annuler</Button><Button onClick={handleMergeRelease} loading={mergingRelease} disabled={!mergeTargetUpc} className="flex-1">Fusionner</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
