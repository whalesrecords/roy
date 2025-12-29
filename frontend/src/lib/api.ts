import type {
  ImportRecord,
  ImportSource,
  PreviewResponse,
  ColumnMapping,
  CreateImportResponse,
  Artist,
  Contract,
  AdvanceEntry,
  RoyaltyRun,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const headers: HeadersInit = {
    'X-Admin-Token': ADMIN_TOKEN,
    ...options?.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Erreur serveur' }));
    throw new Error(error.detail || `Erreur ${res.status}`);
  }

  return res.json();
}

export async function getImports(): Promise<ImportRecord[]> {
  return fetchApi<ImportRecord[]>('/imports');
}

export async function deleteImport(importId: string): Promise<{ success: boolean; deleted_id: string }> {
  return fetchApi<{ success: boolean; deleted_id: string }>(`/imports/${importId}`, {
    method: 'DELETE',
  });
}

export async function createImport(
  file: File,
  source: ImportSource,
  periodStart: string,
  periodEnd: string
): Promise<CreateImportResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('source', source);
  formData.append('period_start', periodStart);
  formData.append('period_end', periodEnd);

  return fetchApi<CreateImportResponse>('/imports', {
    method: 'POST',
    body: formData,
  });
}

export async function getImportPreview(
  importId: string
): Promise<PreviewResponse> {
  return fetchApi<PreviewResponse>(`/imports/${importId}/preview`);
}

export async function saveMapping(
  importId: string,
  mappings: ColumnMapping[]
): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(`/imports/${importId}/mapping`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mappings }),
  });
}

// Artists
export async function getArtists(): Promise<Artist[]> {
  return fetchApi<Artist[]>('/artists');
}

export async function getArtist(artistId: string): Promise<Artist> {
  return fetchApi<Artist>(`/artists/${artistId}`);
}

export async function createArtist(name: string, externalId?: string): Promise<Artist> {
  return fetchApi<Artist>('/artists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, external_id: externalId }),
  });
}

export async function getContracts(artistId: string): Promise<Contract[]> {
  return fetchApi<Contract[]>(`/artists/${artistId}/contracts`);
}

export async function createContract(
  artistId: string,
  data: {
    scope: string;
    scope_id?: string;
    artist_share: number;
    label_share: number;
    start_date: string;
    end_date?: string;
    description?: string;
  }
): Promise<Contract> {
  return fetchApi<Contract>(`/artists/${artistId}/contracts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, artist_id: artistId }),
  });
}

export async function updateContract(
  artistId: string,
  contractId: string,
  data: {
    scope: string;
    scope_id?: string;
    artist_share: number;
    label_share: number;
    start_date: string;
    end_date?: string;
    description?: string;
  }
): Promise<Contract> {
  return fetchApi<Contract>(`/artists/${artistId}/contracts/${contractId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteContract(
  artistId: string,
  contractId: string
): Promise<{ success: boolean; deleted_id: string }> {
  return fetchApi<{ success: boolean; deleted_id: string }>(
    `/artists/${artistId}/contracts/${contractId}`,
    { method: 'DELETE' }
  );
}

export async function getAdvances(artistId: string): Promise<AdvanceEntry[]> {
  return fetchApi<AdvanceEntry[]>(`/artists/${artistId}/advances`);
}

export async function createAdvance(
  artistId: string,
  amount: number,
  currency: string,
  description?: string
): Promise<AdvanceEntry> {
  return fetchApi<AdvanceEntry>(`/artists/${artistId}/advances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artist_id: artistId, amount, currency, description }),
  });
}

export async function getAdvanceBalance(artistId: string): Promise<{ balance: string; currency: string }> {
  return fetchApi<{ balance: string; currency: string }>(`/artists/${artistId}/advance-balance`);
}

// Royalties
export async function getRoyaltyRuns(): Promise<RoyaltyRun[]> {
  return fetchApi<RoyaltyRun[]>('/royalty-runs');
}

export async function getRoyaltyRun(runId: string): Promise<RoyaltyRun> {
  return fetchApi<RoyaltyRun>(`/royalty-runs/${runId}`);
}

export async function createRoyaltyRun(
  periodStart: string,
  periodEnd: string,
  baseCurrency: string = 'EUR'
): Promise<RoyaltyRun> {
  return fetchApi<RoyaltyRun>('/royalty-runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period_start: periodStart, period_end: periodEnd, base_currency: baseCurrency }),
  });
}

export async function lockRoyaltyRun(runId: string): Promise<RoyaltyRun> {
  return fetchApi<RoyaltyRun>(`/royalty-runs/${runId}/lock`, {
    method: 'POST',
  });
}

// Catalog (from imports)
export interface CatalogArtist {
  artist_name: string;
  track_count: number;
  release_count: number;
  total_gross: string;
  total_streams: number;
  currency: string;
}

export interface CatalogRelease {
  release_title: string;
  upc: string;
  track_count: number;
  total_gross: string;
  total_streams: number;
  currency: string;
}

export interface CatalogTrack {
  track_title: string;
  release_title: string;
  isrc: string;
  total_gross: string;
  total_streams: number;
  currency: string;
}

export async function getCatalogArtists(): Promise<CatalogArtist[]> {
  return fetchApi<CatalogArtist[]>('/imports/catalog/artists');
}

export async function getArtistReleases(artistName: string): Promise<CatalogRelease[]> {
  return fetchApi<CatalogRelease[]>(`/imports/catalog/artists/${encodeURIComponent(artistName)}/releases`);
}

export async function getArtistTracks(artistName: string): Promise<CatalogTrack[]> {
  return fetchApi<CatalogTrack[]>(`/imports/catalog/artists/${encodeURIComponent(artistName)}/tracks`);
}

// Import analysis
export interface ImportAnalysis {
  period_start: string | null;
  period_end: string | null;
  artists_with_ampersand: string[];
  total_artists: number;
  duplicate: {
    id: string;
    created_at: string;
    status: string;
    rows_inserted: number;
  } | null;
}

export async function analyzeImport(file: File, source: string): Promise<ImportAnalysis> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('source', source);

  const res = await fetch(`${API_BASE}/imports/analyze`, {
    method: 'POST',
    headers: {
      'X-Admin-Token': ADMIN_TOKEN,
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Erreur serveur' }));
    throw new Error(error.detail || `Erreur ${res.status}`);
  }

  return res.json();
}

// Spotify API

export interface SpotifyStatus {
  configured: boolean;
  message: string;
}

export async function getSpotifyStatus(): Promise<SpotifyStatus> {
  return fetchApi<SpotifyStatus>('/spotify/status');
}

export interface SpotifySearchResult {
  spotify_id?: string;
  name?: string;
  image_url?: string;
  image_url_small?: string;
  popularity?: number;
  genres?: string[];
}

export async function fetchArtistArtwork(artistId: string): Promise<SpotifySearchResult> {
  return fetchApi<SpotifySearchResult>(`/spotify/artists/${artistId}/fetch-artwork`, {
    method: 'POST',
  });
}

export interface SpotifyAlbumResult {
  spotify_id?: string;
  name?: string;
  image_url?: string;
  image_url_small?: string;
  release_date?: string;
  total_tracks?: number;
  artists?: string[];
}

export interface SpotifyTrackResult {
  spotify_id?: string;
  name?: string;
  album_name?: string;
  image_url?: string;
  image_url_small?: string;
  artists?: string[];
  duration_ms?: number;
  popularity?: number;
}

export async function searchAlbumByUPC(upc: string): Promise<SpotifyAlbumResult> {
  return fetchApi<SpotifyAlbumResult>(`/spotify/search/album/upc/${encodeURIComponent(upc)}`);
}

export async function searchTrackByISRC(isrc: string): Promise<SpotifyTrackResult> {
  return fetchApi<SpotifyTrackResult>(`/spotify/search/track/isrc/${encodeURIComponent(isrc)}`);
}

export async function updateArtistArtwork(
  artistId: string,
  data: { image_url?: string; image_url_small?: string; spotify_id?: string }
): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(`/spotify/artists/${artistId}/artwork`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
