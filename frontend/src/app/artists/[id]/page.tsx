'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Tabs, Tab } from '@heroui/react';
import { Artist } from '@/lib/types';
import {
  getArtist,
  fetchArtistArtwork,
  fetchArtistFromSpotifyUrl,
  getArtistReleases,
  getArtistTracks,
} from '@/lib/api';
import OverviewTab from '@/components/artist/tabs/OverviewTab';
import CatalogTab from '@/components/artist/tabs/CatalogTab';
import FinancesTab from '@/components/artist/tabs/FinancesTab';
import ContractsTab from '@/components/artist/tabs/ContractsTab';
import AccessTab from '@/components/artist/tabs/AccessTab';

export default function ArtistDetailPage() {
  const params = useParams();
  const artistId = params.id as string;

  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [releaseCount, setReleaseCount] = useState(0);
  const [trackCount, setTrackCount] = useState(0);
  const [fetchingArtwork, setFetchingArtwork] = useState(false);

  // Edit artwork inline
  const [showEditArtwork, setShowEditArtwork] = useState(false);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-danger mb-4">{error || 'Artiste non trouvé'}</p>
          <Link href="/artists">
            <button className="px-5 py-2.5 bg-content2 text-foreground font-medium rounded-full hover:bg-content3 transition-colors border-2 border-default-200">Retour</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-background/80 backdrop-blur-md border-b border-divider sticky top-14 z-30">
        <div className="max-w-2xl mx-auto px-6 py-5">
          <Link href="/artists" className="text-sm text-secondary-500 hover:text-primary mb-3 inline-flex items-center gap-1 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Artistes
          </Link>
          <div className="flex items-start gap-4 mt-2">
            {/* Artist Image */}
            <div className="relative group">
              {artist.image_url ? (
                <img
                  src={artist.image_url_small || artist.image_url}
                  alt={artist.name}
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/20"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{artist.name}</h1>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-secondary-500">
                  {releaseCount} release{releaseCount > 1 ? 's' : ''} · {trackCount} track{trackCount > 1 ? 's' : ''}
                </p>
                {artist.category === 'collaborator' && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                    Collaborateur
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-secondary-400">
                <span
                  className="cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => navigator.clipboard.writeText(artist.id)}
                  title="Cliquer pour copier"
                >
                  ID: {artist.id.slice(0, 8)}...
                </span>
                {artist.spotify_id && (
                  <span
                    className="cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => navigator.clipboard.writeText(artist.spotify_id!)}
                    title="Cliquer pour copier"
                  >
                    Spotify: {artist.spotify_id}
                  </span>
                )}
                {artist.external_id && (
                  <span
                    className="cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => navigator.clipboard.writeText(artist.external_id!)}
                    title="Cliquer pour copier"
                  >
                    External: {artist.external_id}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {artist.spotify_id && (
                  <a
                    href={`https://open.spotify.com/artist/${artist.spotify_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-success hover:text-success-700"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                    </svg>
                    Profil Spotify
                  </a>
                )}
              </div>
              {!artist.image_url && (
                <button
                  onClick={handleFetchArtwork}
                  disabled={fetchingArtwork}
                  className="mt-2 text-sm text-success hover:text-success-700 inline-flex items-center gap-1"
                >
                  {fetchingArtwork ? (
                    <>
                      <div className="w-3 h-3 border border-green-600 border-t-transparent rounded-full animate-spin" />
                      Recherche...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                      </svg>
                      Chercher sur Spotify
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-6">
        <Tabs
          aria-label="Artist sections"
          variant="underlined"
          classNames={{
            tabList: "gap-4 w-full relative rounded-none p-0 border-b border-divider",
            cursor: "w-full bg-primary",
            tab: "max-w-fit px-0 h-10 text-sm",
            tabContent: "group-data-[selected=true]:text-primary font-medium",
          }}
        >
          <Tab key="overview" title="Vue d'ensemble">
            <div className="py-4">
              <OverviewTab artist={artist} artistId={artistId} onArtistUpdated={loadArtist} />
            </div>
          </Tab>
          <Tab key="catalog" title="Catalogue">
            <div className="py-4">
              <CatalogTab artist={artist} artistId={artistId} />
            </div>
          </Tab>
          <Tab key="finances" title="Finances">
            <div className="py-4">
              <FinancesTab artist={artist} artistId={artistId} />
            </div>
          </Tab>
          <Tab key="contracts" title="Contrats">
            <div className="py-4">
              <ContractsTab artist={artist} artistId={artistId} />
            </div>
          </Tab>
          <Tab key="access" title="Accès">
            <div className="py-4">
              <AccessTab artist={artist} artistId={artistId} onArtistUpdated={loadArtist} />
            </div>
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}
