'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Artist } from '@/lib/types';
import {
  getArtist,
  fetchArtistArtwork,
  fetchArtistFromSpotifyUrl,
  getArtistReleases,
  getArtistTracks,
} from '@/lib/api';
import { Card, Pill, Avatar, OutlineButton } from '@/components/roy/ui';
import { IconChevronRight, IconMusic, IconBox } from '@/components/roy/icons';
import OverviewTab from '@/components/artist/tabs/OverviewTab';
import CatalogTab from '@/components/artist/tabs/CatalogTab';
import FinancesTab from '@/components/artist/tabs/FinancesTab';
import ContractsTab from '@/components/artist/tabs/ContractsTab';
import AccessTab from '@/components/artist/tabs/AccessTab';

type ArtistTab = 'overview' | 'catalog' | 'finances' | 'contracts' | 'access';

const TAB_LABELS: Record<ArtistTab, string> = {
  overview: "Vue d'ensemble",
  catalog: 'Catalogue',
  finances: 'Finances',
  contracts: 'Contrats',
  access: 'Accès',
};
const ARTIST_TABS = Object.keys(TAB_LABELS) as ArtistTab[];

export default function ArtistDetailPage() {
  const params = useParams();
  const artistId = params.id as string;

  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [releaseCount, setReleaseCount] = useState(0);
  const [trackCount, setTrackCount] = useState(0);
  const [fetchingArtwork, setFetchingArtwork] = useState(false);
  const [activeTab, setActiveTab] = useState<ArtistTab>('overview');

  // Edit artwork inline
  const [editImageUrl, setEditImageUrl] = useState('');
  const [spotifyProfileUrl, setSpotifyProfileUrl] = useState('');

  const loadArtist = async () => {
    try {
      const artistData = await getArtist(artistId);
      setArtist(artistData);

      // Load catalog counts
      if (artistData.name) {
        try {
          const [releasesData, tracksData] = await Promise.all([
            getArtistReleases(artistData.name),
            getArtistTracks(artistData.name),
          ]);
          setReleaseCount(releasesData.length);
          setTrackCount(tracksData.length);
        } catch {
          // Catalog counts optional
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArtist();
  }, [artistId]);

  const handleFetchArtwork = async () => {
    setFetchingArtwork(true);
    try {
      if (spotifyProfileUrl.trim()) {
        const result = await fetchArtistFromSpotifyUrl(artistId, spotifyProfileUrl.trim());
        if (result.image_url) setEditImageUrl(result.image_url);
      } else {
        await fetchArtistArtwork(artistId);
      }
      loadArtist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur Spotify');
    } finally {
      setFetchingArtwork(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <div className="text-center">
          <p className="text-neg mb-4 text-[13px]">{error || 'Artiste non trouvé'}</p>
          <Link href="/artists">
            <OutlineButton>Retour</OutlineButton>
          </Link>
        </div>
      </div>
    );
  }

  const categoryLabel = artist.category === 'signed' ? 'Signé' : 'Collaborateur';

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <Link
          href="/artists"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-muted hover:text-ink transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Artistes
        </Link>
        <span className="text-ink-faint">
          <IconChevronRight size={14} />
        </span>
        <h1 className="text-[14px] font-semibold text-ink truncate">{artist.name}</h1>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {/* Artist header */}
        <Card hero className="!p-5 lg:!p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <Avatar name={artist.name} src={artist.image_url_small || artist.image_url} size={84} accent />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-[24px] lg:text-[26px] font-bold tracking-[-0.02em] text-ink">{artist.name}</h2>
                <Pill tone={artist.category === 'signed' ? 'accent' : 'neutral'}>{categoryLabel}</Pill>
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 text-[11.5px] text-ink-faint">
                <span
                  className="cursor-pointer hover:text-ink transition-colors font-mono"
                  onClick={() => navigator.clipboard.writeText(artist.id)}
                  title="Cliquer pour copier"
                >
                  ID {artist.id.slice(0, 8)}…
                </span>
                {artist.spotify_id && (
                  <span
                    className="cursor-pointer hover:text-ink transition-colors font-mono"
                    onClick={() => navigator.clipboard.writeText(artist.spotify_id!)}
                    title="Cliquer pour copier"
                  >
                    Spotify {artist.spotify_id.slice(0, 10)}…
                  </span>
                )}
                {artist.external_id && (
                  <span
                    className="cursor-pointer hover:text-ink transition-colors font-mono"
                    onClick={() => navigator.clipboard.writeText(artist.external_id!)}
                    title="Cliquer pour copier"
                  >
                    Ext {artist.external_id}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                {artist.spotify_id && (
                  <a
                    href={`https://open.spotify.com/artist/${artist.spotify_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-accent hover:opacity-80 transition-opacity"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                    </svg>
                    Profil Spotify
                  </a>
                )}
                <button
                  onClick={handleFetchArtwork}
                  disabled={fetchingArtwork}
                  className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
                  title={artist.image_url ? 'Mettre à jour la photo depuis Spotify' : 'Chercher la photo sur Spotify'}
                >
                  {fetchingArtwork ? (
                    <>
                      <div className="w-3 h-3 border border-ink-muted border-t-transparent rounded-full animate-spin" />
                      Mise à jour…
                    </>
                  ) : (
                    artist.image_url ? 'Rafraîchir photo' : 'Chercher photo Spotify'
                  )}
                </button>
              </div>
            </div>
            {/* Key stats */}
            <div className="flex gap-3 sm:flex-col sm:gap-2.5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
                  <IconBox size={16} />
                </div>
                <div>
                  <div className="roy-num text-[17px] font-bold text-ink leading-none">{releaseCount}</div>
                  <div className="text-[10.5px] text-ink-faint mt-0.5">release{releaseCount > 1 ? 's' : ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[10px] bg-surface border border-line text-ink-muted flex items-center justify-center shrink-0">
                  <IconMusic size={16} />
                </div>
                <div>
                  <div className="roy-num text-[17px] font-bold text-ink leading-none">{trackCount}</div>
                  <div className="text-[10.5px] text-ink-faint mt-0.5">track{trackCount > 1 ? 's' : ''}</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Segmented tab control */}
        <div className="flex gap-1 rounded-[11px] border border-line bg-surface p-1 w-fit overflow-x-auto">
          {ARTIST_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-[12.5px] whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-accent-soft text-accent font-semibold'
                  : 'text-ink-muted hover:text-ink font-medium'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Active tab content */}
        {activeTab === 'overview' && (
          <OverviewTab artist={artist} artistId={artistId} onArtistUpdated={loadArtist} />
        )}
        {activeTab === 'catalog' && <CatalogTab artist={artist} artistId={artistId} />}
        {activeTab === 'finances' && <FinancesTab artist={artist} artistId={artistId} />}
        {activeTab === 'contracts' && <ContractsTab artist={artist} artistId={artistId} />}
        {activeTab === 'access' && (
          <AccessTab artist={artist} artistId={artistId} onArtistUpdated={loadArtist} />
        )}
      </div>
    </div>
  );
}
