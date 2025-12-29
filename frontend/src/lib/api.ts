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
    const message = typeof error.detail === 'string'
      ? error.detail
      : (error.detail?.message || error.message || `Erreur ${res.status}`);
    throw new Error(message);
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

export async function updateArtist(
  artistId: string,
  data: { name?: string; spotify_id?: string; image_url?: string; image_url_small?: string }
): Promise<Artist> {
  return fetchApi<Artist>(`/artists/${artistId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteArtist(artistId: string): Promise<{ success: boolean; deleted_id: string }> {
  return fetchApi<{ success: boolean; deleted_id: string }>(`/artists/${artistId}`, {
    method: 'DELETE',
  });
}

export async function mergeArtists(
  targetId: string,
  sourceIds: string[]
): Promise<{ success: boolean; target_id: string; merged_count: number; message: string }> {
  return fetchApi<{ success: boolean; target_id: string; merged_count: number; message: string }>(
    `/artists/${targetId}/merge`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_ids: sourceIds }),
    }
  );
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
    scope_id?: string | null;
    artist_share: number;
    label_share: number;
    start_date: string;
    end_date?: string;
    description?: string;
  }
): Promise<Contract> {
  const payload = {
    artist_id: artistId,
    scope: data.scope,
    scope_id: data.scope === 'catalog' ? null : data.scope_id,
    artist_share: data.artist_share,
    label_share: data.label_share,
    start_date: data.start_date,
    end_date: data.end_date || null,
    description: data.description || null,
  };
  return fetchApi<Contract>(`/artists/${artistId}/contracts/${contractId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
  description?: string,
  scope: 'track' | 'release' | 'catalog' = 'catalog',
  scopeId?: string
): Promise<AdvanceEntry> {
  return fetchApi<AdvanceEntry>(`/artists/${artistId}/advances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      artist_id: artistId,
      amount,
      currency,
      scope,
      scope_id: scopeId,
      description,
    }),
  });
}

export async function getAdvanceBalance(artistId: string): Promise<{ balance: string; currency: string }> {
  return fetchApi<{ balance: string; currency: string }>(`/artists/${artistId}/advance-balance`);
}

export async function updateAdvance(
  artistId: string,
  advanceId: string,
  amount: number,
  currency: string,
  description?: string,
  scope: 'track' | 'release' | 'catalog' = 'catalog',
  scopeId?: string
): Promise<AdvanceEntry> {
  return fetchApi<AdvanceEntry>(`/artists/${artistId}/advances/${advanceId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      artist_id: artistId,
      amount,
      currency,
      scope,
      scope_id: scopeId,
      description,
    }),
  });
}

export async function deleteAdvance(
  artistId: string,
  advanceId: string
): Promise<{ success: boolean; deleted_id: string }> {
  return fetchApi<{ success: boolean; deleted_id: string }>(
    `/artists/${artistId}/advances/${advanceId}`,
    { method: 'DELETE' }
  );
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
  baseCurrency: string = 'EUR',
  artistIds?: string[]
): Promise<RoyaltyRun> {
  return fetchApi<RoyaltyRun>('/royalty-runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      period_start: periodStart,
      period_end: periodEnd,
      base_currency: baseCurrency,
      artist_ids: artistIds && artistIds.length > 0 ? artistIds : null,
    }),
  });
}

export async function lockRoyaltyRun(runId: string): Promise<RoyaltyRun> {
  return fetchApi<RoyaltyRun>(`/royalty-runs/${runId}/lock`, {
    method: 'POST',
  });
}

export async function deleteRoyaltyRun(runId: string): Promise<{ success: boolean; deleted_id: string }> {
  return fetchApi<{ success: boolean; deleted_id: string }>(`/royalty-runs/${runId}`, {
    method: 'DELETE',
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
    const message = typeof error.detail === 'string'
      ? error.detail
      : (error.detail?.message || error.message || `Erreur ${res.status}`);
    throw new Error(message);
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

// Artist royalty calculation

export interface AlbumRoyalty {
  release_title: string;
  upc: string;
  track_count: number;
  gross: string;
  artist_share: string;
  label_share: string;
  artist_royalties: string;
  label_royalties: string;
  streams: number;
}

export interface SourceBreakdown {
  source: string;
  source_label: string;
  gross: string;
  artist_royalties: string;
  label_royalties: string;
  transaction_count: number;
  streams: number;
}

export interface ArtistRoyaltyCalculation {
  artist_id: string;
  artist_name: string;
  period_start: string;
  period_end: string;
  currency: string;
  total_gross: string;
  total_artist_royalties: string;
  total_label_royalties: string;
  advance_balance: string;
  recoupable: string;
  net_payable: string;
  albums: AlbumRoyalty[];
  sources: SourceBreakdown[];
}

export async function calculateArtistRoyalties(
  artistId: string,
  periodStart: string,
  periodEnd: string
): Promise<ArtistRoyaltyCalculation> {
  return fetchApi<ArtistRoyaltyCalculation>(
    `/artists/${artistId}/calculate-royalties?period_start=${periodStart}&period_end=${periodEnd}`,
    { method: 'POST' }
  );
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

// Track-Artist Links (Multi-artist support)

export interface TrackArtistLink {
  id: string;
  isrc: string;
  artist_id: string;
  artist_name: string;
  share_percent: string;
  track_title?: string;
  release_title?: string;
}

export interface CatalogTrackWithLinks {
  isrc: string;
  track_title: string;
  release_title: string;
  upc?: string;
  total_gross: string;
  total_streams: number;
  original_artist_name: string;
  linked_artists: TrackArtistLink[];
  is_linked: boolean;
}

export interface CollaborationSuggestion {
  isrc: string;
  track_title: string;
  original_artist_name: string;
  detected_artists: {
    name: string;
    exists: boolean;
    artist_id?: string;
    artist_name: string;
  }[];
  suggested_equal_split: string;
}

export async function getCatalogTracks(params?: {
  search?: string;
  has_links?: boolean;
  limit?: number;
  offset?: number;
}): Promise<CatalogTrackWithLinks[]> {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set('search', params.search);
  if (params?.has_links !== undefined) queryParams.set('has_links', String(params.has_links));
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.offset) queryParams.set('offset', String(params.offset));

  const query = queryParams.toString();
  return fetchApi<CatalogTrackWithLinks[]>(`/catalog/tracks${query ? `?${query}` : ''}`);
}

export async function getTrackDetails(isrc: string): Promise<CatalogTrackWithLinks> {
  return fetchApi<CatalogTrackWithLinks>(`/catalog/tracks/${encodeURIComponent(isrc)}`);
}

export async function linkArtistsToTrack(
  isrc: string,
  links: { artist_id: string; share_percent: number }[]
): Promise<TrackArtistLink[]> {
  return fetchApi<TrackArtistLink[]>(`/catalog/tracks/${encodeURIComponent(isrc)}/artists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(links),
  });
}

export async function unlinkArtistFromTrack(
  isrc: string,
  artistId: string
): Promise<{ success: boolean; message: string }> {
  return fetchApi<{ success: boolean; message: string }>(
    `/catalog/tracks/${encodeURIComponent(isrc)}/artists/${artistId}`,
    { method: 'DELETE' }
  );
}

export async function getCollaborationSuggestions(
  limit: number = 50
): Promise<CollaborationSuggestion[]> {
  return fetchApi<CollaborationSuggestion[]>(`/catalog/tracks/suggestions/collaborations?limit=${limit}`);
}

// Label Settings

export interface LabelSettings {
  id: string;
  label_name: string;
  logo_url?: string;
  logo_base64?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  email?: string;
  phone?: string;
  website?: string;
  siret?: string;
  vat_number?: string;
}

export async function getLabelSettings(): Promise<LabelSettings | null> {
  return fetchApi<LabelSettings | null>('/settings/label');
}

export async function updateLabelSettings(data: Partial<Omit<LabelSettings, 'id' | 'logo_base64'>>): Promise<LabelSettings> {
  return fetchApi<LabelSettings>('/settings/label', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function uploadLabelLogo(file: File): Promise<LabelSettings> {
  const formData = new FormData();
  formData.append('file', file);

  return fetchApi<LabelSettings>('/settings/label/logo', {
    method: 'POST',
    body: formData,
  });
}

export async function deleteLabelLogo(): Promise<LabelSettings> {
  return fetchApi<LabelSettings>('/settings/label/logo', {
    method: 'DELETE',
  });
}

// Payments

export async function getPayments(artistId: string): Promise<AdvanceEntry[]> {
  return fetchApi<AdvanceEntry[]>(`/artists/${artistId}/payments`);
}

export async function createPayment(
  artistId: string,
  amount: number,
  currency: string,
  description?: string,
  paymentDate?: string
): Promise<AdvanceEntry> {
  return fetchApi<AdvanceEntry>(`/artists/${artistId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      artist_id: artistId,
      amount,
      currency,
      description,
      payment_date: paymentDate,
    }),
  });
}

export async function deletePayment(
  artistId: string,
  paymentId: string
): Promise<{ success: boolean; deleted_id: string }> {
  return fetchApi<{ success: boolean; deleted_id: string }>(
    `/artists/${artistId}/payments/${paymentId}`,
    { method: 'DELETE' }
  );
}

// Re-export types from types.ts for convenience
export type { Artist, Contract, AdvanceEntry, RoyaltyRun } from './types';
