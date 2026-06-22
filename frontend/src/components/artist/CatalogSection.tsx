'use client';

import { useState, useEffect, useCallback } from 'react';
import { Spinner } from '@heroui/react';
import { AccentButton, OutlineButton, Pill } from '@/components/roy/ui';
import { IconDownload, IconCheck, IconChevronRight } from '@/components/roy/icons';
import {
  getArtistReleases,
  getArtistTracks,
  getCachedReleaseArtworks,
  getReleaseMetadata,
  refreshReleaseMetadata,
  getTracksMetadata,
  batchRefreshReleases,
  CatalogRelease,
  CatalogTrack,
  SpotifyAlbumResult,
  CatalogReleaseMetadata,
  linkUpcToRelease,
} from '@/lib/api';

interface SpotifyAlbum {
  spotify_id: string;
  name: string;
  album_type: string;
  release_date: string;
  total_tracks: number;
  image_url: string | null;
  image_url_small: string | null;
  artists: string[];
  external_urls: { spotify?: string };
}

interface SpotifyTrack {
  spotify_id: string;
  name: string;
  track_number: number;
  disc_number: number;
  duration_ms: number;
  explicit: boolean;
  artists: string[];
  isrc: string | null;
}

interface SpotifyAlbumDetails {
  tracks: SpotifyTrack[];
  release_date: string;
  genres: string[];
  label: string;
}

interface CatalogSectionProps {
  artistName: string;
  artistSpotifyId?: string;
}

interface EnrichedRelease {
  // From imports
  release_title: string;
  upc: string;
  track_count: number;
  total_gross: string;
  total_streams: number;
  currency: string;
  physical_format?: string;
  // From Spotify
  spotify_id?: string;
  release_date?: string;
  genres?: string[];
  label?: string;
  image_url?: string;
  image_url_small?: string;
  // Enriched tracks
  tracks: EnrichedTrack[];
  // Source info
  isFromImports: boolean;
  isFromSpotify: boolean;
}

interface EnrichedTrack {
  track_title: string;
  isrc: string;
  track_number?: number;
  duration_ms?: number;
  artists?: string[];
  // From imports
  total_gross?: string;
  total_streams?: number;
  currency?: string;
  // For merge feature
  merged_from?: string[]; // Original track titles that were merged
}

interface DuplicateGroup {
  normalizedName: string;
  tracks: { releaseKey: string; trackIndex: number; track: EnrichedTrack }[];
}

// Format duration from ms to MM:SS
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Normalize string for comparison (remove special chars, lowercase)
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Normalize track name for duplicate detection (more aggressive)
function normalizeTrackName(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\.(wav|mp3|flac|aiff?|m4a)$/i, '') // Remove audio extensions
    .replace(/\s*\([^)]*\)\s*/g, '') // Remove parentheses content
    .replace(/\s*\[[^\]]*\]\s*/g, '') // Remove brackets content
    .replace(/[^a-z0-9]/g, '') // Keep only alphanumeric
    .trim();
}

export default function CatalogSection({ artistName, artistSpotifyId }: CatalogSectionProps) {
  const [releases, setReleases] = useState<EnrichedRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set());
  const [loadingTracks, setLoadingTracks] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Refresh state
  const [refreshingReleases, setRefreshingReleases] = useState<Set<string>>(new Set());
  const [refreshingAll, setRefreshingAll] = useState(false);

  // Merge feature state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedMerges, setSelectedMerges] = useState<Set<string>>(new Set());

  // Load and merge catalog data
  useEffect(() => {
    async function loadCatalog() {
      if (!artistName) return;

      setLoading(true);
      setError(null);

      try {
        // Load data from imports
        const [importReleases, importTracks] = await Promise.all([
          getArtistReleases(artistName),
          getArtistTracks(artistName),
        ]);

        // Create initial releases from imports
        const releasesMap = new Map<string, EnrichedRelease>();

        for (const release of importReleases) {
          const key = release.upc || normalizeString(release.release_title);
          const existingTracks = importTracks.filter(t => t.release_title === release.release_title);

          releasesMap.set(key, {
            release_title: release.release_title,
            upc: release.upc || '',
            track_count: release.track_count,
            total_gross: release.total_gross,
            total_streams: release.total_streams,
            currency: release.currency,
            physical_format: release.physical_format,
            tracks: existingTracks.map((t, idx) => ({
              track_title: t.track_title,
              isrc: t.isrc,
              track_number: idx + 1,
              total_gross: t.total_gross,
              total_streams: t.total_streams,
              currency: t.currency,
            })),
            isFromImports: true,
            isFromSpotify: false,
          });
        }

        // Load cached metadata from database for releases with UPCs
        const upcs = importReleases.map(r => r.upc).filter(Boolean);
        if (upcs.length > 0) {
          try {
            // Load metadata for each UPC from database (cached Spotify data)
            const metadataPromises = upcs.map(upc => getReleaseMetadata(upc).catch(() => null));
            const metadataResults = await Promise.all(metadataPromises);

            for (const metadata of metadataResults) {
              if (metadata?.found && metadata.upc) {
                const release = releasesMap.get(metadata.upc);
                if (release) {
                  release.image_url = metadata.image_url;
                  release.image_url_small = metadata.image_url_small;
                  release.spotify_id = metadata.spotify_id;
                  release.release_date = metadata.release_date;
                  release.genres = metadata.genres;
                  release.label = metadata.label;
                  release.isFromSpotify = true;

                  // Load track metadata from DB cache
                  if (metadata.tracks && metadata.tracks.length > 0) {
                    const trackMap = new Map(metadata.tracks.map(t => [t.isrc, t]));
                    release.tracks = release.tracks.map(track => {
                      const cachedTrack = trackMap.get(track.isrc);
                      if (cachedTrack) {
                        return {
                          ...track,
                          duration_ms: cachedTrack.duration_ms,
                          track_number: cachedTrack.track_number || track.track_number,
                          artists: cachedTrack.artists,
                        };
                      }
                      return track;
                    });
                  }
                }
              }
            }

            // Also try to get basic artwork for releases without full metadata
            const artworks = await getCachedReleaseArtworks(upcs);
            for (const artwork of artworks) {
              if (artwork.upc) {
                const release = releasesMap.get(artwork.upc);
                if (release && !release.image_url) {
                  release.image_url = artwork.image_url;
                  release.image_url_small = artwork.image_url_small;
                  release.spotify_id = artwork.spotify_id;
                }
              }
            }
          } catch (e) {
            console.error('Failed to fetch metadata:', e);
          }
        }

        setReleases(Array.from(releasesMap.values()));

        // Now load Spotify albums if we have a Spotify ID
        if (artistSpotifyId) {
          setLoadingSpotify(true);
          try {
            const response = await fetch(`/api/backend/spotify/artists/${artistSpotifyId}/albums`, {
              headers: { 'X-Admin-Token': process.env.NEXT_PUBLIC_ADMIN_TOKEN || '' },
            });

            if (response.ok) {
              const data = await response.json();
              const spotifyAlbums: SpotifyAlbum[] = data.items || [];

              // Merge Spotify albums with existing releases
              for (const album of spotifyAlbums) {
                const normalizedName = normalizeString(album.name);

                // Check if this album already exists (by name match)
                let existingKey: string | null = null;
                Array.from(releasesMap.entries()).forEach(([key, release]) => {
                  if (normalizeString(release.release_title) === normalizedName) {
                    existingKey = key;
                  }
                });

                if (existingKey) {
                  // Enrich existing release with Spotify data
                  const existing = releasesMap.get(existingKey)!;
                  existing.spotify_id = album.spotify_id;
                  existing.release_date = album.release_date;
                  existing.image_url = existing.image_url || album.image_url || undefined;
                  existing.image_url_small = existing.image_url_small || album.image_url_small || undefined;
                  existing.isFromSpotify = true;
                } else {
                  // New release from Spotify only
                  releasesMap.set(`spotify-${album.spotify_id}`, {
                    release_title: album.name,
                    upc: '',
                    track_count: album.total_tracks,
                    total_gross: '0',
                    total_streams: 0,
                    currency: 'EUR',
                    spotify_id: album.spotify_id,
                    release_date: album.release_date,
                    image_url: album.image_url || undefined,
                    image_url_small: album.image_url_small || undefined,
                    tracks: [],
                    isFromImports: false,
                    isFromSpotify: true,
                  });
                }
              }

              setReleases(Array.from(releasesMap.values()));
            }
          } catch (e) {
            console.error('Failed to load Spotify albums:', e);
          } finally {
            setLoadingSpotify(false);
          }
        }
      } catch (e) {
        console.error('Failed to load catalog:', e);
        setError('Erreur lors du chargement du catalogue');
      } finally {
        setLoading(false);
      }
    }

    loadCatalog();
  }, [artistName, artistSpotifyId]);

  // Load tracks from Spotify when expanding a release
  const loadSpotifyTracks = useCallback(async (release: EnrichedRelease) => {
    if (!release.spotify_id || loadingTracks.has(release.spotify_id)) return;

    setLoadingTracks(prev => new Set(prev).add(release.spotify_id!));

    try {
      const response = await fetch(`/api/backend/spotify/albums/${release.spotify_id}/tracks`, {
        headers: { 'X-Admin-Token': process.env.NEXT_PUBLIC_ADMIN_TOKEN || '' },
      });

      if (response.ok) {
        const data: SpotifyAlbumDetails = await response.json();

        setReleases(prev => prev.map(r => {
          if (r.spotify_id !== release.spotify_id) return r;

          // Merge Spotify tracks with existing tracks
          const mergedTracks: EnrichedTrack[] = [];
          const existingIsrcs = new Set(r.tracks.map(t => t.isrc).filter(Boolean));

          // First, add Spotify tracks
          for (const spotifyTrack of data.tracks) {
            const existingTrack = r.tracks.find(t =>
              t.isrc === spotifyTrack.isrc ||
              normalizeString(t.track_title) === normalizeString(spotifyTrack.name)
            );

            if (existingTrack) {
              mergedTracks.push({
                ...existingTrack,
                track_number: spotifyTrack.track_number,
                duration_ms: spotifyTrack.duration_ms,
                isrc: spotifyTrack.isrc || existingTrack.isrc,
                artists: spotifyTrack.artists,
              });
            } else {
              mergedTracks.push({
                track_title: spotifyTrack.name,
                isrc: spotifyTrack.isrc || '',
                track_number: spotifyTrack.track_number,
                duration_ms: spotifyTrack.duration_ms,
                artists: spotifyTrack.artists,
              });
            }
          }

          // Sort by track number
          mergedTracks.sort((a, b) => (a.track_number || 0) - (b.track_number || 0));

          return {
            ...r,
            tracks: mergedTracks,
            release_date: data.release_date || r.release_date,
            genres: data.genres,
            label: data.label,
          };
        }));
      }
    } catch (e) {
      console.error('Failed to load Spotify tracks:', e);
    } finally {
      setLoadingTracks(prev => {
        const next = new Set(prev);
        next.delete(release.spotify_id!);
        return next;
      });
    }
  }, [loadingTracks]);

  // Toggle release expansion
  const toggleRelease = (release: EnrichedRelease) => {
    const key = release.upc || release.spotify_id || release.release_title;
    setExpandedReleases(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // Load Spotify tracks if needed
        if (release.spotify_id && release.tracks.length === 0) {
          loadSpotifyTracks(release);
        }
      }
      return next;
    });
  };

  // Refresh a single release from Spotify API
  const refreshRelease = useCallback(async (release: EnrichedRelease) => {
    if (!release.upc) return;

    setError(null); // Clear any previous error
    setRefreshingReleases(prev => new Set(prev).add(release.upc));

    try {
      const result = await refreshReleaseMetadata(release.upc);
      if (result.success) {
        // Reload metadata from DB
        const metadata = await getReleaseMetadata(release.upc);
        if (metadata.found) {
          setReleases(prev => prev.map(r => {
            if (r.upc !== release.upc) return r;

            const trackMap = new Map(metadata.tracks?.map(t => [t.isrc, t]) || []);
            return {
              ...r,
              image_url: metadata.image_url,
              image_url_small: metadata.image_url_small,
              spotify_id: metadata.spotify_id,
              release_date: metadata.release_date,
              genres: metadata.genres,
              label: metadata.label,
              isFromSpotify: true,
              tracks: r.tracks.map(track => {
                const cachedTrack = trackMap.get(track.isrc);
                if (cachedTrack) {
                  return {
                    ...track,
                    duration_ms: cachedTrack.duration_ms,
                    track_number: cachedTrack.track_number || track.track_number,
                    artists: cachedTrack.artists,
                  };
                }
                return track;
              }),
            };
          }));
        }
      }
    } catch (e) {
      console.error('Failed to refresh release:', e);
      const errorMessage = e instanceof Error ? e.message : 'Erreur inconnue';
      setError(`Erreur lors du rafraichissement: ${errorMessage}`);
    } finally {
      setRefreshingReleases(prev => {
        const next = new Set(prev);
        next.delete(release.upc);
        return next;
      });
    }
  }, []);

  // Refresh all releases from Spotify API
  const refreshAllReleases = useCallback(async () => {
    const upcs = releases.filter(r => r.upc).map(r => r.upc);
    if (upcs.length === 0) return;

    setError(null); // Clear any previous error
    setRefreshingAll(true);

    try {
      const result = await batchRefreshReleases(upcs);

      // Reload all metadata from DB
      const metadataPromises = upcs.map(upc => getReleaseMetadata(upc).catch(() => null));
      const metadataResults = await Promise.all(metadataPromises);

      const metadataMap = new Map<string, CatalogReleaseMetadata>();
      for (const m of metadataResults) {
        if (m?.found) {
          metadataMap.set(m.upc, m);
        }
      }

      setReleases(prev => prev.map(r => {
        if (!r.upc) return r;
        const metadata = metadataMap.get(r.upc);
        if (!metadata) return r;

        const trackMap = new Map(metadata.tracks?.map(t => [t.isrc, t]) || []);
        return {
          ...r,
          image_url: metadata.image_url,
          image_url_small: metadata.image_url_small,
          spotify_id: metadata.spotify_id,
          release_date: metadata.release_date,
          genres: metadata.genres,
          label: metadata.label,
          isFromSpotify: true,
          tracks: r.tracks.map(track => {
            const cachedTrack = trackMap.get(track.isrc);
            if (cachedTrack) {
              return {
                ...track,
                duration_ms: cachedTrack.duration_ms,
                track_number: cachedTrack.track_number || track.track_number,
                artists: cachedTrack.artists,
              };
            }
            return track;
          }),
        };
      }));

      // Show result notification
      console.log(`Refreshed ${result.success_count}/${result.total} releases`);
    } catch (e) {
      console.error('Failed to refresh all releases:', e);
      const errorMessage = e instanceof Error ? e.message : 'Erreur inconnue';
      setError(`Erreur lors du rafraichissement: ${errorMessage}`);
    } finally {
      setRefreshingAll(false);
    }
  }, [releases]);

  // Detect duplicate tracks across all releases
  // Only consider tracks as duplicates if they have the same ISRC or at least one is missing ISRC
  const detectDuplicates = useCallback(() => {
    const tracksByNormalizedName = new Map<string, { releaseKey: string; trackIndex: number; track: EnrichedTrack }[]>();

    releases.forEach(release => {
      const releaseKey = release.upc || release.spotify_id || release.release_title;
      release.tracks.forEach((track, trackIndex) => {
        const normalized = normalizeTrackName(track.track_title);
        if (!normalized) return;

        const existing = tracksByNormalizedName.get(normalized) || [];
        existing.push({ releaseKey, trackIndex, track });
        tracksByNormalizedName.set(normalized, existing);
      });
    });

    // Filter to only groups with 2+ tracks that could be duplicates
    // Tracks with different ISRCs are NOT duplicates
    const groups: DuplicateGroup[] = [];
    tracksByNormalizedName.forEach((tracks, normalizedName) => {
      if (tracks.length > 1) {
        // Filter out tracks that have different ISRCs from each other
        // Only keep tracks that either:
        // 1. Have no ISRC
        // 2. Have the same ISRC as at least one other track in the group
        const isrcGroups = new Map<string, typeof tracks>();
        const noIsrcTracks: typeof tracks = [];

        tracks.forEach(t => {
          if (!t.track.isrc) {
            noIsrcTracks.push(t);
          } else {
            const existing = isrcGroups.get(t.track.isrc) || [];
            existing.push(t);
            isrcGroups.set(t.track.isrc, existing);
          }
        });

        // Only create a duplicate group if:
        // - There are tracks without ISRC that match named tracks, OR
        // - There are multiple tracks with the same ISRC (shouldn't happen but possible with import errors)
        // Tracks with different ISRCs should NOT be merged

        // If all tracks have unique ISRCs, skip this group (not duplicates)
        const allHaveUniqueIsrcs = noIsrcTracks.length === 0 &&
          Array.from(isrcGroups.values()).every(g => g.length === 1);

        if (!allHaveUniqueIsrcs) {
          // Include tracks without ISRC + tracks that share an ISRC
          const validTracks = [...noIsrcTracks];
          isrcGroups.forEach(isrcGroup => {
            if (isrcGroup.length > 1 || noIsrcTracks.length > 0) {
              validTracks.push(...isrcGroup);
            }
          });

          if (validTracks.length > 1) {
            groups.push({ normalizedName, tracks: validTracks });
          }
        }
      }
    });

    setDuplicateGroups(groups);
    setSelectedMerges(new Set(groups.map(g => g.normalizedName))); // Select all by default
    setShowMergeModal(true);
  }, [releases]);

  // Merge selected duplicate groups
  const executeMerge = useCallback(() => {
    if (selectedMerges.size === 0) {
      setShowMergeModal(false);
      return;
    }

    setReleases(prevReleases => {
      const newReleases = [...prevReleases];

      duplicateGroups.forEach(group => {
        if (!selectedMerges.has(group.normalizedName)) return;

        // Find the "best" track (prefer the one with ISRC, duration, or most complete data)
        const sortedTracks = [...group.tracks].sort((a, b) => {
          // Prefer tracks with ISRC
          if (a.track.isrc && !b.track.isrc) return -1;
          if (!a.track.isrc && b.track.isrc) return 1;
          // Prefer tracks with duration
          if (a.track.duration_ms && !b.track.duration_ms) return -1;
          if (!a.track.duration_ms && b.track.duration_ms) return 1;
          // Prefer shorter name (likely cleaner)
          return a.track.track_title.length - b.track.track_title.length;
        });

        const primaryTrack = sortedTracks[0];
        const tracksToMerge = sortedTracks.slice(1);

        // Merge data from other tracks into primary
        const mergedTrack: EnrichedTrack = {
          ...primaryTrack.track,
          merged_from: [primaryTrack.track.track_title, ...tracksToMerge.map(t => t.track.track_title)],
        };

        // Combine streams and gross
        let totalStreams = primaryTrack.track.total_streams || 0;
        let totalGross = parseFloat(primaryTrack.track.total_gross || '0');

        tracksToMerge.forEach(t => {
          totalStreams += t.track.total_streams || 0;
          totalGross += parseFloat(t.track.total_gross || '0');
          // Take ISRC from any track that has it
          if (!mergedTrack.isrc && t.track.isrc) {
            mergedTrack.isrc = t.track.isrc;
          }
          // Take duration from any track that has it
          if (!mergedTrack.duration_ms && t.track.duration_ms) {
            mergedTrack.duration_ms = t.track.duration_ms;
          }
        });

        mergedTrack.total_streams = totalStreams;
        mergedTrack.total_gross = totalGross.toFixed(2);

        // Update primary release with merged track
        const primaryReleaseIdx = newReleases.findIndex(r =>
          (r.upc || r.spotify_id || r.release_title) === primaryTrack.releaseKey
        );
        if (primaryReleaseIdx !== -1) {
          const newTracks = [...newReleases[primaryReleaseIdx].tracks];
          newTracks[primaryTrack.trackIndex] = mergedTrack;
          newReleases[primaryReleaseIdx] = {
            ...newReleases[primaryReleaseIdx],
            tracks: newTracks,
          };
        }

        // Remove merged tracks from their releases
        tracksToMerge.forEach(t => {
          const releaseIdx = newReleases.findIndex(r =>
            (r.upc || r.spotify_id || r.release_title) === t.releaseKey
          );
          if (releaseIdx !== -1) {
            const newTracks = newReleases[releaseIdx].tracks.filter((_, idx) => idx !== t.trackIndex);
            newReleases[releaseIdx] = {
              ...newReleases[releaseIdx],
              tracks: newTracks,
              track_count: newTracks.length,
            };
          }
        });
      });

      return newReleases;
    });

    setShowMergeModal(false);
    setDuplicateGroups([]);
    setSelectedMerges(new Set());
  }, [duplicateGroups, selectedMerges]);

  // Check if there are potential duplicates
  // Only consider tracks as duplicates if they have the same name AND (same ISRC OR at least one missing ISRC)
  const hasPotentialDuplicates = (() => {
    // Group tracks by normalized name
    const tracksByName = new Map<string, { isrc: string | null }[]>();
    releases.forEach(r => r.tracks.forEach(t => {
      const norm = normalizeTrackName(t.track_title);
      if (!norm) return;
      const existing = tracksByName.get(norm) || [];
      existing.push({ isrc: t.isrc || null });
      tracksByName.set(norm, existing);
    }));

    // Check if any group has mergeable duplicates
    const trackGroups = Array.from(tracksByName.values());
    for (const tracks of trackGroups) {
      if (tracks.length < 2) continue;

      // Check if there are tracks without ISRC or tracks sharing the same ISRC
      const hasNoIsrc = tracks.some((t: { isrc: string | null }) => !t.isrc);
      const isrcCounts = new Map<string, number>();
      tracks.forEach((t: { isrc: string | null }) => {
        if (t.isrc) {
          isrcCounts.set(t.isrc, (isrcCounts.get(t.isrc) || 0) + 1);
        }
      });
      const hasDuplicateIsrc = Array.from(isrcCounts.values()).some(c => c > 1);

      // If there's a track without ISRC or duplicate ISRCs, there are potential duplicates
      if (hasNoIsrc || hasDuplicateIsrc) {
        return true;
      }
    }
    return false;
  })();

  // Export Label Copy CSV
  const exportLabelCopy = async () => {
    setExporting(true);

    try {
      // First, enrich all releases with Spotify data if not already done
      const releasesToEnrich = releases.filter(r => r.spotify_id && r.tracks.length === 0);

      for (const release of releasesToEnrich) {
        await loadSpotifyTracks(release);
      }

      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get updated releases
      const currentReleases = releases;

      // Prepare CSV data
      const rows: string[][] = [];

      // Header row
      rows.push([
        'Release Title',
        'UPC',
        'Release Date',
        'Track Number',
        'Track Title',
        'ISRC',
        'Duration',
        'Artist',
        'Label',
        'Genre',
        'Format',
      ]);

      // Data rows - sorted by release date
      const sortedReleases = [...currentReleases].sort((a, b) => {
        const dateA = a.release_date || '';
        const dateB = b.release_date || '';
        return dateB.localeCompare(dateA); // Most recent first
      });

      for (const release of sortedReleases) {
        const genreStr = release.genres?.join(', ') || '';
        const labelStr = release.label || 'Whales Records';
        const formatStr = release.physical_format || 'Digital';

        if (release.tracks.length === 0) {
          // Release without tracks
          rows.push([
            release.release_title,
            release.upc || '',
            release.release_date || '',
            '',
            '',
            '',
            '',
            artistName,
            labelStr,
            genreStr,
            formatStr,
          ]);
        } else {
          // Release with tracks
          for (const track of release.tracks) {
            const durationStr = track.duration_ms ? formatDuration(track.duration_ms) : '';
            const trackArtists = track.artists?.join(', ') || artistName;

            rows.push([
              release.release_title,
              release.upc || '',
              release.release_date || '',
              String(track.track_number || ''),
              track.track_title,
              track.isrc || '',
              durationStr,
              trackArtists,
              labelStr,
              genreStr,
              formatStr,
            ]);
          }
        }
      }

      // Convert to CSV
      const csvContent = rows
        .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

      // Download file
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `label_copy_${artistName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
      setError('Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  // Sort releases by date (most recent first)
  const sortedReleases = [...releases].sort((a, b) => {
    const dateA = a.release_date || '';
    const dateB = b.release_date || '';
    return dateB.localeCompare(dateA);
  });

  const signedCount = releases.filter(r => r.isFromImports).length;
  const spotifyOnlyCount = releases.filter(r => !r.isFromImports && r.isFromSpotify).length;

  if (loading) {
    return (
      <div className="bg-surface border border-line rounded-[16px] shadow-roy overflow-hidden">
        <div className="px-[22px] py-4 border-b border-line">
          <h2 className="text-[13.5px] font-semibold text-ink">Catalogue</h2>
        </div>
        <div className="px-4 py-10 text-center">
          <Spinner size="md" />
          <p className="text-[12.5px] text-ink-faint mt-3">Chargement du catalogue…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-line rounded-[16px] shadow-roy overflow-hidden">
      <div className="px-[22px] py-4 border-b border-line flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[13.5px] font-semibold text-ink">Catalogue</h2>
          <p className="text-[11.5px] text-ink-faint mt-0.5">
            {releases.length} sortie{releases.length > 1 ? 's' : ''}
            {spotifyOnlyCount > 0 && (
              <span className="text-ink-muted ml-1">
                (dont {spotifyOnlyCount} non signée{spotifyOnlyCount > 1 ? 's' : ''})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh All from Spotify */}
          <OutlineButton
            onClick={refreshAllReleases}
            className={refreshingAll || releases.length === 0 ? 'opacity-50 pointer-events-none' : ''}
          >
            {refreshingAll ? (
              <div className="w-3.5 h-3.5 border-2 border-ink-muted border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Actualiser Spotify
          </OutlineButton>

          {hasPotentialDuplicates && (
            <button
              onClick={detectDuplicates}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-accent-soft px-3.5 py-2 text-[12px] font-semibold text-accent hover:opacity-90 transition-opacity"
              title="Fusionner les tracks en double"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Fusionner doublons
            </button>
          )}
          <AccentButton
            onClick={exportLabelCopy}
            disabled={exporting || releases.length === 0}
          >
            {exporting ? <Spinner size="sm" color="white" /> : <IconDownload size={14} />}
            {exporting ? 'Export…' : 'Export Label Copy'}
          </AccentButton>
        </div>
      </div>

      {error && (
        <div className="px-[22px] py-3 border-b border-line text-neg text-[12.5px]">
          {error}
        </div>
      )}

      {loadingSpotify && (
        <div className="px-[22px] py-2.5 border-b border-line bg-accent-soft text-accent text-[12.5px] flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Chargement des sorties Spotify…
        </div>
      )}

      {releases.length === 0 ? (
        <p className="px-4 py-8 text-center text-ink-faint text-[13px]">
          Aucune sortie trouvée
          {artistSpotifyId && !loadingSpotify && ' (vérifiez le Spotify ID)'}
        </p>
      ) : (
        <div className="divide-y divide-line">
          {sortedReleases.map((release) => {
            const key = release.upc || release.spotify_id || release.release_title;
            const isExpanded = expandedReleases.has(key);
            const isLoadingTracks = release.spotify_id ? loadingTracks.has(release.spotify_id) : false;
            const isSpotifyOnly = !release.isFromImports && release.isFromSpotify;

            return (
              <div key={key}>
                <div
                  className={`px-[22px] py-3 cursor-pointer hover:bg-surface-2 transition-colors ${isSpotifyOnly ? 'bg-surface-2/60' : ''}`}
                  onClick={() => toggleRelease(release)}
                >
                  <div className="flex items-center gap-3">
                    {/* Artwork */}
                    <div className="flex-shrink-0">
                      {release.image_url_small ? (
                        <img
                          src={release.image_url_small}
                          alt={release.release_title}
                          className="w-12 h-12 rounded-[12px] object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-[12px]" style={{ background: 'var(--cover)' }} />
                      )}
                    </div>

                    {/* Release info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13.5px] font-semibold text-ink truncate">{release.release_title}</p>
                        {isSpotifyOnly && (
                          <Pill tone="neutral">Non signée</Pill>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-ink-faint flex-wrap mt-0.5">
                        {release.release_date && (
                          <span className="text-[11px]">{release.release_date}</span>
                        )}
                        {release.upc ? (
                          <span className="font-mono text-[10.5px]">UPC {release.upc}</span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const upc = prompt(`Entrer le UPC pour "${release.release_title}" :`);
                              if (upc && upc.trim()) {
                                linkUpcToRelease(artistName, release.release_title, upc.trim())
                                  .then((res) => {
                                    if (res.success) {
                                      alert(`UPC lié ! ${res.updated_count} transaction(s) mises à jour. Rechargez la page.`);
                                      window.location.reload();
                                    }
                                  })
                                  .catch((err) => alert(`Erreur: ${err.message}`));
                              }
                            }}
                            className="font-mono text-[10.5px] font-semibold text-accent bg-accent-soft px-2 py-0.5 rounded-full hover:opacity-90 transition-opacity"
                          >
                            + Lier UPC
                          </button>
                        )}
                        <span className="text-[11px]">{release.track_count} track{release.track_count > 1 ? 's' : ''}</span>
                        {release.label && (
                          <span className="text-[10.5px] text-ink-muted bg-surface-2 px-2 py-0.5 rounded-md">{release.label}</span>
                        )}
                      </div>
                      {release.genres && release.genres.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {release.genres.slice(0, 3).map(g => (
                            <span key={g} className="text-[10.5px] font-semibold bg-accent-soft text-accent px-2 py-0.5 rounded-full">
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    {release.isFromImports && (
                      <div className="text-right">
                        <p className="roy-num text-[13px] font-bold text-ink">
                          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: release.currency }).format(parseFloat(release.total_gross))}
                        </p>
                        {release.total_streams > 0 && (
                          <p className="roy-num text-[11px] text-ink-faint">
                            {new Intl.NumberFormat('fr-FR').format(release.total_streams)} streams
                          </p>
                        )}
                      </div>
                    )}

                    {/* Refresh button */}
                    {release.upc && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          refreshRelease(release);
                        }}
                        disabled={refreshingReleases.has(release.upc)}
                        className="p-2 text-ink-faint hover:text-ink hover:bg-surface-2 rounded-[8px] transition-colors disabled:opacity-50"
                        title="Actualiser depuis Spotify"
                      >
                        {refreshingReleases.has(release.upc) ? (
                          <div className="w-4 h-4 border-2 border-ink-faint border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                      </button>
                    )}

                    {/* Expand icon */}
                    {isLoadingTracks ? (
                      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <IconChevronRight
                        size={18}
                        className={`text-ink-faint transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    )}
                  </div>
                </div>

                {/* Expanded tracks */}
                {isExpanded && (
                  <div className="bg-surface-2 px-[22px] py-2 border-t border-line">
                    {release.tracks.length === 0 ? (
                      <p className="text-[12.5px] text-ink-faint py-2">
                        {isLoadingTracks ? 'Chargement des tracks…' : 'Aucune track trouvée'}
                      </p>
                    ) : (
                      <div className="divide-y divide-line">
                        {release.tracks.map((track, trackIdx) => (
                          <div key={track.isrc || `track-${trackIdx}`} className="py-2.5 flex items-center gap-3">
                            <span className="text-[11px] text-ink-faint w-6 text-right roy-num shrink-0">
                              {track.track_number || trackIdx + 1}.
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-[13px] font-medium text-ink truncate">{track.track_title}</p>
                                {track.merged_from && track.merged_from.length > 1 && (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10.5px] font-semibold rounded-full bg-accent-soft text-accent cursor-help shrink-0"
                                    title={`Fusionné depuis: ${track.merged_from.join(', ')}`}
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                    {track.merged_from.length}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10.5px] text-ink-faint mt-0.5">
                                {track.isrc && (
                                  <span className="font-mono">ISRC {track.isrc}</span>
                                )}
                                {track.artists && track.artists.length > 0 && (
                                  <span>{track.artists.join(', ')}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-[11px] text-ink-faint flex items-center gap-3 roy-num">
                              {track.duration_ms && (
                                <span className="font-mono">{formatDuration(track.duration_ms)}</span>
                              )}
                              {track.total_gross && parseFloat(track.total_gross) > 0 && (
                                <span className="text-ink font-semibold">
                                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: track.currency || 'EUR' }).format(parseFloat(track.total_gross))}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-line rounded-[16px] shadow-roy max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-ink">Fusionner les tracks en double</h3>
                <p className="text-[12px] text-ink-faint mt-0.5">
                  {duplicateGroups.length} groupe{duplicateGroups.length > 1 ? 's' : ''} de doublons détecté{duplicateGroups.length > 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setShowMergeModal(false)}
                className="p-2 -mr-2 text-ink-faint hover:text-ink transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {duplicateGroups.length === 0 ? (
                <p className="text-center text-ink-faint text-[13px] py-8">Aucun doublon détecté</p>
              ) : (
                duplicateGroups.map(group => {
                  const isSelected = selectedMerges.has(group.normalizedName);
                  return (
                    <div
                      key={group.normalizedName}
                      className={`p-4 rounded-[12px] border transition-colors cursor-pointer ${
                        isSelected ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'
                      }`}
                      onClick={() => {
                        setSelectedMerges(prev => {
                          const next = new Set(prev);
                          if (next.has(group.normalizedName)) {
                            next.delete(group.normalizedName);
                          } else {
                            next.add(group.normalizedName);
                          }
                          return next;
                        });
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-[6px] border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong'
                        }`}>
                          {isSelected && <IconCheck size={12} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-ink mb-2">
                            Tracks similaires ({group.tracks.length})
                          </p>
                          <div className="space-y-1">
                            {group.tracks.map((t, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-[13px]">
                                {idx === 0 && (
                                  <span className="px-1.5 py-0.5 text-[10.5px] font-semibold rounded-full bg-accent-soft text-accent">Principal</span>
                                )}
                                <span className={idx === 0 ? 'font-medium text-ink' : 'text-ink-faint line-through'}>
                                  {t.track.track_title}
                                </span>
                                {t.track.isrc && (
                                  <span className="text-[10.5px] font-mono text-ink-faint">({t.track.isrc})</span>
                                )}
                              </div>
                            ))}
                          </div>
                          {group.tracks.some(t => t.track.total_streams) && (
                            <p className="text-[11px] text-ink-faint mt-2 roy-num">
                              Total streams après fusion: {new Intl.NumberFormat('fr-FR').format(
                                group.tracks.reduce((sum, t) => sum + (t.track.total_streams || 0), 0)
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 py-4 border-t border-line flex items-center justify-between gap-3 bg-surface-2">
              <p className="text-[12px] text-ink-faint">
                {selectedMerges.size} fusion{selectedMerges.size > 1 ? 's' : ''} sélectionnée{selectedMerges.size > 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <OutlineButton onClick={() => setShowMergeModal(false)}>
                  Annuler
                </OutlineButton>
                <AccentButton
                  onClick={executeMerge}
                  disabled={selectedMerges.size === 0}
                >
                  <IconCheck size={14} />
                  Fusionner
                </AccentButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
