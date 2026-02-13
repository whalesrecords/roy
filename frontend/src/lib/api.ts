import type {
  ImportRecord,
  ImportSource,
  PreviewResponse,
  ColumnMapping,
  CreateImportResponse,
  Artist,
  Contract,
  ContractParty,
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

export interface SaleTypeBreakdown {
  type: string;
  count: number;
  total: string;
}

export interface PhysicalFormatBreakdown {
  format: string;
  count: number;
  total: string;
}

export interface ImportSaleTypesResponse {
  import_id: string;
  source: string;
  sale_types: SaleTypeBreakdown[];
  physical_formats: PhysicalFormatBreakdown[];
}

export async function getImportSaleTypes(importId: string): Promise<ImportSaleTypesResponse> {
  return fetchApi<ImportSaleTypesResponse>(`/imports/${importId}/sale-types`);
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

export interface ArtistSummary {
  id: string;
  name: string;
  external_id?: string;
  spotify_id?: string;
  image_url?: string;
  image_url_small?: string;
  created_at: string;
  total_gross: string;
  total_streams: number;
  transaction_count: number;
  has_collaborations: boolean;
}

export async function getArtistsSummary(): Promise<ArtistSummary[]> {
  return fetchApi<ArtistSummary[]>('/artists/summary');
}

export interface SimilarArtistGroup {
  canonical_name: string;
  artists: Artist[];
}

export async function getDuplicateArtists(): Promise<SimilarArtistGroup[]> {
  return fetchApi<SimilarArtistGroup[]>('/artists/duplicates');
}

export async function mergeArtists(sourceId: string, targetId: string): Promise<{
  success: boolean;
  message: string;
  links_transferred: number;
  advances_transferred: number;
  contracts_transferred: number;
}> {
  return fetchApi(`/artists/merge?source_id=${sourceId}&target_id=${targetId}`, {
    method: 'POST',
  });
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
  data: { name?: string; spotify_id?: string; image_url?: string; image_url_small?: string; category?: 'signed' | 'collaborator' }
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

export async function generateAccessCode(artistId: string): Promise<{ access_code: string }> {
  return fetchApi<{ access_code: string }>(`/artist-portal/generate-code/${artistId}`, {
    method: 'POST',
  });
}

export async function createArtistAuth(artistId: string, email: string, password: string): Promise<{ message: string; auth_user_id: string; email: string }> {
  return fetchApi<{ message: string; auth_user_id: string; email: string }>('/artist-portal/create-auth', {
    method: 'POST',
    body: JSON.stringify({ artist_id: artistId, email, password }),
  });
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
  scopeId?: string,
  category?: string,
  effectiveDate?: string
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
      category,
      description,
      effective_date: effectiveDate,
    }),
  });
}

export interface AdvanceBalanceResponse {
  balance: string;
  currency: string;
  total_advances: string;
  total_recouped: string;
  total_payments: string;
}

export async function getAdvanceBalance(artistId: string): Promise<AdvanceBalanceResponse> {
  return fetchApi<AdvanceBalanceResponse>(`/artists/${artistId}/advance-balance`);
}

export async function updateAdvance(
  artistId: string,
  advanceId: string,
  amount: number,
  currency: string,
  description?: string,
  scope: 'track' | 'release' | 'catalog' = 'catalog',
  scopeId?: string,
  category?: string,
  effectiveDate?: string
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
      category,
      description,
      effective_date: effectiveDate,
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

export async function deleteRoyaltyRun(runId: string, force: boolean = false): Promise<{ success: boolean; deleted_id: string }> {
  const url = force ? `/royalty-runs/${runId}?force=true` : `/royalty-runs/${runId}`;
  return fetchApi<{ success: boolean; deleted_id: string }>(url, {
    method: 'DELETE',
  });
}

// Create statement for artist (publish to artist portal)
export interface StatementCreate {
  artist_id: string;
  period_start: string;
  period_end: string;
  currency: string;
  gross_revenue: string;
  artist_royalties: string;
  label_royalties: string;
  advance_balance: string;
  recouped: string;
  net_payable: string;
  transaction_count: number;
  finalize: boolean;
}

export interface StatementCreated {
  id: string;
  artist_id: string;
  period_start: string;
  period_end: string;
  currency: string;
  status: string;
  gross_revenue: string;
  artist_royalties: string;
  net_payable: string;
}

export async function createStatement(artistId: string, data: StatementCreate): Promise<StatementCreated> {
  return fetchApi<StatementCreated>(`/artists/${artistId}/statements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export interface StatementsListResponse {
  artist_id: string;
  statements: StatementCreated[];
  total_count: number;
}

export async function getArtistStatements(artistId: string): Promise<StatementsListResponse> {
  return fetchApi<StatementsListResponse>(`/artists/${artistId}/statements`);
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

export interface CatalogReleaseSource {
  store_name: string;
  physical_format?: string | null;
  gross: string;
  quantity: number;
  track_count: number;
}

export interface CatalogRelease {
  release_title: string;
  upc: string;
  track_count: number;
  total_gross: string;
  total_streams: number;
  currency: string;
  sources?: CatalogReleaseSource[];  // Per-source breakdown
  // Legacy fields (kept for backwards compat during transition)
  physical_format?: string;
  store_name?: string;
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

export async function linkUpcToRelease(artistName: string, releaseTitle: string, upc: string): Promise<{ success: boolean; updated_count: number }> {
  const formData = new FormData();
  formData.append('artist_name', artistName);
  formData.append('release_title', releaseTitle);
  formData.append('upc', upc);
  return fetchApi('/imports/catalog/link-upc', { method: 'POST', body: formData });
}

export async function mergeRelease(artistName: string, sourceUpc: string, targetUpc: string): Promise<{ success: boolean; updated_count: number }> {
  const formData = new FormData();
  formData.append('artist_name', artistName);
  formData.append('source_upc', sourceUpc);
  formData.append('target_upc', targetUpc);
  return fetchApi('/imports/catalog/merge-release', { method: 'POST', body: formData });
}

export async function getArtistTracks(artistName: string): Promise<CatalogTrack[]> {
  return fetchApi<CatalogTrack[]>(`/imports/catalog/artists/${encodeURIComponent(artistName)}/tracks`);
}

export interface ReleaseTrack {
  track_title: string;
  isrc: string;
  artist_name: string;
  total_gross: string;
  total_streams: number;
}

export async function getReleaseTracks(upc: string): Promise<ReleaseTrack[]> {
  return fetchApi<ReleaseTrack[]>(`/imports/catalog/releases/${encodeURIComponent(upc)}/tracks`);
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

export async function fetchArtistFromSpotifyUrl(artistId: string, spotifyUrl: string): Promise<SpotifySearchResult> {
  return fetchApi<SpotifySearchResult>(`/spotify/artists/${artistId}/fetch-from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spotify_url: spotifyUrl }),
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

export interface CachedArtwork {
  upc?: string;
  isrc?: string;
  spotify_id?: string;
  name?: string;
  album_name?: string;
  image_url?: string;
  image_url_small?: string;
}

export async function getCachedReleaseArtworks(upcs: string[]): Promise<CachedArtwork[]> {
  if (upcs.length === 0) return [];
  return fetchApi<CachedArtwork[]>(`/spotify/artwork/releases?upcs=${upcs.join(',')}`);
}

export async function getCachedTrackArtworks(isrcs: string[]): Promise<CachedArtwork[]> {
  if (isrcs.length === 0) return [];
  return fetchApi<CachedArtwork[]>(`/spotify/artwork/tracks?isrcs=${isrcs.join(',')}`);
}

// Catalog metadata (cached Spotify data)

export interface CatalogTrackMetadata {
  isrc: string;
  spotify_id?: string;
  name?: string;
  track_number?: number;
  disc_number?: number;
  duration_ms?: number;
  artists?: string[];
}

export interface CatalogReleaseMetadata {
  found: boolean;
  upc: string;
  spotify_id?: string;
  name?: string;
  image_url?: string;
  image_url_small?: string;
  release_date?: string;
  genres?: string[];
  label?: string;
  total_tracks?: number;
  album_type?: string;
  tracks?: CatalogTrackMetadata[];
  updated_at?: string;
}

export async function getReleaseMetadata(upc: string): Promise<CatalogReleaseMetadata> {
  return fetchApi<CatalogReleaseMetadata>(`/spotify/catalog/releases/${upc}`);
}

export async function refreshReleaseMetadata(upc: string): Promise<{ success: boolean; tracks_updated: number }> {
  return fetchApi(`/spotify/catalog/releases/${upc}/refresh`, { method: 'POST' });
}

export async function getTracksMetadata(isrcs: string[]): Promise<CatalogTrackMetadata[]> {
  if (isrcs.length === 0) return [];
  return fetchApi<CatalogTrackMetadata[]>(`/spotify/catalog/tracks?isrcs=${isrcs.join(',')}`);
}

export async function batchRefreshReleases(upcs: string[]): Promise<{
  total: number;
  success_count: number;
  failed_count: number;
  not_found_count: number;
}> {
  return fetchApi('/spotify/catalog/releases/batch-refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upcs }),
  });
}

// Artist royalty calculation

export interface AlbumSourceBreakdown {
  source: string;
  source_label: string;
  sale_type: string;  // "stream", "cd", "vinyl", "k7", "digital", "other"
  gross: string;
  artist_royalties: string;
  quantity: number;
}

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
  advance_balance: string;  // Scoped advances for this album
  recoupable: string;       // Amount deducted from this album
  net_payable: string;      // Net after scoped advance deduction
  included_in_upc?: string; // If this single is included in an album's recoupment
  sources?: AlbumSourceBreakdown[];  // Per-source breakdown (stream vs physical)
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
  // Clear advance breakdown
  total_advances: string;  // Total advances given
  total_recouped_before: string;  // Already recouped in previous periods
  recoupable: string;  // Recouped this period
  remaining_advance: string;  // What's left after this period
  advance_balance: string;  // Legacy: current balance before this period
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
  paymentDate?: string,
  statementId?: string
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
      statement_id: statementId,
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

export async function updatePayment(
  artistId: string,
  paymentId: string,
  amount?: number,
  description?: string,
  paymentDate?: string
): Promise<AdvanceEntry> {
  return fetchApi<AdvanceEntry>(`/artists/${artistId}/payments/${paymentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      description,
      payment_date: paymentDate,
    }),
  });
}

// Expense Report types
export interface CategoryExpense {
  category: string;
  category_label: string;
  total_amount: string;
  count: number;
  currency: string;
}

export interface ExpenseReportEntry {
  id: string;
  artist_id: string | null;
  entry_type: string;
  amount: string;
  currency: string;
  scope: string;
  scope_id: string | null;
  category: string | null;
  royalty_run_id: string | null;
  description: string | null;
  reference: string | null;
  effective_date: string;
  created_at: string;
}

export interface ExpenseReport {
  total_expenses: string;
  currency: string;
  by_category: CategoryExpense[];
  entries: ExpenseReportEntry[];
}

export async function getExpenseReport(params?: {
  artist_id?: string;
  scope?: string;
  scope_id?: string;
  category?: string;
}): Promise<ExpenseReport> {
  const searchParams = new URLSearchParams();
  if (params?.artist_id) searchParams.append('artist_id', params.artist_id);
  if (params?.scope) searchParams.append('scope', params.scope);
  if (params?.scope_id) searchParams.append('scope_id', params.scope_id);
  if (params?.category) searchParams.append('category', params.category);

  const query = searchParams.toString();
  return fetchApi<ExpenseReport>(`/artists/expenses/report${query ? `?${query}` : ''}`);
}

// Analytics types
export interface MonthlyRevenue {
  month: number;
  year: number;
  month_label: string;
  gross: string;
  source_breakdown: Record<string, string>;
}

export interface SourceRevenue {
  source: string;
  source_label: string;
  gross: string;
  transaction_count: number;
}

export interface MonthlyExpense {
  month: number;
  year: number;
  month_label: string;
  amount: string;
  category_breakdown: Record<string, string>;
}

export interface CategoryExpenseAnalytics {
  category: string;
  category_label: string;
  amount: string;
  count: number;
}

export interface RoyaltiesPayable {
  period_start: string;
  period_end: string;
  net_payable: string;
  status: string;
}

export interface AnalyticsSummary {
  total_revenue: string;
  total_expenses: string;
  total_royalties_payable: string;
  total_outflow: string;
  net: string;
  currency: string;
  monthly_revenue: MonthlyRevenue[];
  monthly_expenses: MonthlyExpense[];
  revenue_by_source: SourceRevenue[];
  expenses_by_category: CategoryExpenseAnalytics[];
  royalties_payable: RoyaltiesPayable[];
}

export async function getAnalyticsSummary(year: number): Promise<AnalyticsSummary> {
  return fetchApi<AnalyticsSummary>(`/analytics/summary?year=${year}`);
}

// Finances API

export interface ExpenseEntry {
  id: string;
  artist_id: string | null;
  artist_name: string | null;
  entry_type: string;
  amount: string;
  currency: string;
  scope: string;
  scope_id: string | null;
  scope_title: string | null;
  category: string | null;
  category_label: string | null;
  royalty_run_id: string | null;
  description: string | null;
  reference: string | null;
  document_url: string | null;
  effective_date: string;
  created_at: string;
}

export interface RoyaltyPayment {
  run_id: string;
  period_start: string;
  period_end: string;
  total_net_payable: string;
  total_artist_royalties: string;
  total_recouped: string;
  status: string;
  locked_at: string | null;
  artists_count: number;
}

export interface FinancesSummary {
  total_expenses: string;
  total_royalties_payable: string;
  expenses_count: number;
  royalty_runs_count: number;
  currency: string;
}

export async function getFinancesSummary(year?: number): Promise<FinancesSummary> {
  const query = year ? `?year=${year}` : '';
  return fetchApi<FinancesSummary>(`/finances/summary${query}`);
}

export async function getExpenses(params?: {
  year?: number;
  category?: string;
  artist_id?: string;
}): Promise<ExpenseEntry[]> {
  const searchParams = new URLSearchParams();
  if (params?.year) searchParams.append('year', String(params.year));
  if (params?.category) searchParams.append('category', params.category);
  if (params?.artist_id) searchParams.append('artist_id', params.artist_id);
  const query = searchParams.toString();
  return fetchApi<ExpenseEntry[]>(`/finances/expenses${query ? `?${query}` : ''}`);
}

export async function createExpense(data: {
  artist_id?: string;
  amount: string;
  currency?: string;
  scope?: string;
  scope_id?: string;
  category?: string;
  description?: string;
  reference?: string;
  effective_date?: string;
}): Promise<ExpenseEntry> {
  return fetchApi<ExpenseEntry>('/finances/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateExpense(
  expenseId: string,
  data: {
    artist_id?: string;
    amount?: string;
    currency?: string;
    scope?: string;
    scope_id?: string;
    category?: string;
    description?: string;
    reference?: string;
    effective_date?: string;
  }
): Promise<ExpenseEntry> {
  return fetchApi<ExpenseEntry>(`/finances/expenses/${expenseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteExpense(expenseId: string): Promise<{ success: boolean; deleted_id: string }> {
  return fetchApi<{ success: boolean; deleted_id: string }>(`/finances/expenses/${expenseId}`, {
    method: 'DELETE',
  });
}

export async function uploadExpenseDocument(expenseId: string, file: File): Promise<{ success: boolean; expense_id: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return fetchApi<{ success: boolean; expense_id: string }>(`/finances/expenses/${expenseId}/document`, {
    method: 'POST',
    body: formData,
  });
}

export async function deleteExpenseDocument(expenseId: string): Promise<{ success: boolean; expense_id: string }> {
  return fetchApi<{ success: boolean; expense_id: string }>(`/finances/expenses/${expenseId}/document`, {
    method: 'DELETE',
  });
}

export async function getRoyaltyPayments(year?: number): Promise<RoyaltyPayment[]> {
  const query = year ? `?year=${year}` : '';
  return fetchApi<RoyaltyPayment[]>(`/finances/royalty-payments${query}`);
}

// Re-export types from types.ts for convenience
export type { Artist, Contract, AdvanceEntry, RoyaltyRun, ContractParty } from './types';

// ===== Contracts API =====

export interface ContractData {
  id?: string;
  artist_id: string;
  scope: 'track' | 'release' | 'catalog';
  scope_id?: string;
  start_date: string;
  end_date?: string;
  description?: string;
  parties: ContractParty[];
  created_at?: string;
  updated_at?: string;
}

export async function getContracts(artistId?: string, scope?: string): Promise<ContractData[]> {
  const params = new URLSearchParams();
  if (artistId) params.append('artist_id', artistId);
  if (scope) params.append('scope', scope);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi<ContractData[]>(`/contracts${query}`);
}

export async function getContract(contractId: string): Promise<ContractData> {
  return fetchApi<ContractData>(`/contracts/${contractId}`);
}

export async function createContract(data: Omit<ContractData, 'id' | 'created_at' | 'updated_at'>): Promise<ContractData> {
  return fetchApi<ContractData>('/contracts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateContract(contractId: string, data: Partial<ContractData>): Promise<ContractData> {
  return fetchApi<ContractData>(`/contracts/${contractId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteContract(contractId: string): Promise<{ success: boolean; deleted_id: string }> {
  return fetchApi<{ success: boolean; deleted_id: string }>(`/contracts/${contractId}`, {
    method: 'DELETE',
  });
}

export async function uploadContractDocument(contractId: string, file: File): Promise<{ success: boolean; contract_id: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return fetchApi<{ success: boolean; contract_id: string }>(`/contracts/${contractId}/document`, {
    method: 'POST',
    body: formData,
  });
}

export async function deleteContractDocument(contractId: string): Promise<{ success: boolean; contract_id: string }> {
  return fetchApi<{ success: boolean; contract_id: string }>(`/contracts/${contractId}/document`, {
    method: 'DELETE',
  });
}

export async function getActiveContractsForArtist(artistId: string, asOfDate?: string): Promise<ContractData[]> {
  const query = asOfDate ? `?as_of_date=${asOfDate}` : '';
  return fetchApi<ContractData[]>(`/contracts/artist/${artistId}/active${query}`);
}

// ===== Invoice Import API =====

import type { ExtractedInvoice, CreateAdvanceFromInvoice, AdvanceCreatedResponse } from './types';

export async function extractInvoiceData(file: File): Promise<ExtractedInvoice> {
  const formData = new FormData();
  formData.append('file', file);

  return fetchApi<ExtractedInvoice>('/invoice-import/extract', {
    method: 'POST',
    body: formData,
  });
}

export async function batchExtractInvoices(files: File[]): Promise<ExtractedInvoice[]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  return fetchApi<ExtractedInvoice[]>('/invoice-import/batch-extract', {
    method: 'POST',
    body: formData,
  });
}

export async function createAdvanceFromInvoice(data: CreateAdvanceFromInvoice): Promise<AdvanceCreatedResponse> {
  return fetchApi<AdvanceCreatedResponse>('/invoice-import/create-advance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function batchCreateAdvancesFromInvoices(advances: CreateAdvanceFromInvoice[]): Promise<AdvanceCreatedResponse[]> {
  return fetchApi<AdvanceCreatedResponse[]>('/invoice-import/batch-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(advances),
  });
}

// ============ Notifications ============

export interface Notification {
  id: string;
  type: 'payment_request' | 'profile_update';
  artist_id: string | null;
  artist_name: string | null;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
  const params = unreadOnly ? '?unread_only=true' : '';
  return fetchApi<Notification[]>(`/artist-portal/notifications${params}`);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await fetchApi(`/artist-portal/notifications/${notificationId}/read`, {
    method: 'PUT',
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetchApi('/artist-portal/notifications/read-all', {
    method: 'PUT',
  });
}

// ============ Tickets ============

export interface TicketMessage {
  id: string;
  message: string;
  sender_type: 'artist' | 'admin' | 'system';
  sender_name: string | null;
  is_internal: boolean;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  category: string;
  category_label: string;
  status: string;
  status_label: string;
  priority: string;
  priority_label: string;
  artist_names?: string[];
  unread_count: number;
  last_message_at: string;
  created_at: string;
}

export interface TicketDetail {
  id: string;
  ticket_number: string;
  subject: string;
  category: string;
  category_label: string;
  status: string;
  status_label: string;
  priority: string;
  priority_label: string;
  assigned_to: string | null;
  messages: TicketMessage[];
  participants: string[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
}

export interface TicketStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  by_category: Record<string, number>;
}

export interface CreateTicketRequest {
  subject: string;
  category: string;
  message: string;
  artist_ids: string[];
  priority?: string;
}

export interface UpdateTicketRequest {
  status?: string;
  priority?: string;
  assigned_to?: string;
}

export interface AddMessageRequest {
  message: string;
  is_internal?: boolean;
}

export async function getTicketStats(): Promise<TicketStats> {
  return fetchApi<TicketStats>('/tickets/stats');
}

export async function getTickets(params?: {
  status?: string;
  category?: string;
  artist_id?: string;
  priority?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<Ticket[]> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.set('status', params.status);
  if (params?.category) queryParams.set('category', params.category);
  if (params?.artist_id) queryParams.set('artist_id', params.artist_id);
  if (params?.priority) queryParams.set('priority', params.priority);
  if (params?.search) queryParams.set('search', params.search);
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.offset) queryParams.set('offset', params.offset.toString());

  const query = queryParams.toString();
  return fetchApi<Ticket[]>(`/tickets${query ? `?${query}` : ''}`);
}

export async function getTicketDetail(ticketId: string): Promise<TicketDetail> {
  return fetchApi<TicketDetail>(`/tickets/${ticketId}`);
}

export async function createTicket(data: CreateTicketRequest): Promise<TicketDetail> {
  return fetchApi<TicketDetail>('/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateTicket(ticketId: string, data: UpdateTicketRequest): Promise<TicketDetail> {
  return fetchApi<TicketDetail>(`/tickets/${ticketId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function addTicketMessage(ticketId: string, data: AddMessageRequest): Promise<TicketMessage> {
  return fetchApi<TicketMessage>(`/tickets/${ticketId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteTicket(ticketId: string): Promise<void> {
  await fetchApi(`/tickets/${ticketId}`, {
    method: 'DELETE',
  });
}


// ============ Promo API ============

export interface PromoSubmission {
  id: string;
  artist_id: string;
  release_upc: string | null;
  track_isrc: string | null;
  song_title: string;
  source: string;
  campaign_id: string | null;
  campaign_url: string | null;
  outlet_name: string | null;
  outlet_type: string | null;
  action: string | null;
  listen_time: number | null;
  influencer_name: string | null;
  influencer_type: string | null;
  decision: string | null;
  sharing_link: string | null;
  feedback: string | null;
  submitted_at: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  artist_name: string | null;
  release_title: string | null;
}

export interface TrackSummary {
  song_title: string;
  artist_id: string;
  artist_name: string;
  release_title: string | null;
  release_upc: string | null;
  track_isrc: string | null;
  total_submissions: number;
  total_listened: number;
  total_approved: number;
  total_declined: number;
  total_shared: number;
  total_playlists: number;
  sources: string[];
  latest_submitted_at: string | null;
}

export interface TracksSummaryResponse {
  tracks: TrackSummary[];
  total_tracks: number;
}

export interface SubmitHubAnalyzeResponse {
  total_rows: number;
  sample_rows: any[];
  columns_detected: string[];
  warnings: string[];
}

export interface GrooverAnalyzeResponse {
  total_rows: number;
  sample_rows: any[];
  columns_detected: string[];
  warnings: string[];
}

export interface SongMatch {
  song_title: string;
  track_isrc: string | null;
  release_upc: string | null;
  match_confidence: string;
}

export interface ImportSubmitHubResponse {
  created_count: number;
  matched_songs: SongMatch[];
  unmatched_songs: string[];
  campaign_id: string | null;
  errors: string[];
}

export interface ImportGrooverResponse {
  created_count: number;
  matched_songs: SongMatch[];
  unmatched_songs: string[];
  campaign_id: string | null;
  errors: string[];
}

export interface PromoStats {
  total_submissions: number;
  by_source: Record<string, number>;
  by_action: Record<string, number>;
  by_decision: Record<string, number>;
  total_listens: number;
  total_approvals: number;
  total_playlists: number;
}

export interface ArtistPromoStats {
  artist_id: string;
  artist_name: string;
  total_submissions: number;
  total_listened: number;
  total_approved: number;
  total_declined: number;
  total_shared: number;
  total_playlists: number;
  approval_rate: number;
}

export interface AlbumPromoStats {
  release_upc: string | null;
  release_title: string;
  artist_id: string;
  artist_name: string;
  total_submissions: number;
  total_listened: number;
  total_approved: number;
  total_declined: number;
  total_shared: number;
  total_playlists: number;
  approval_rate: number;
}

export interface DetailedPromoStats {
  // Global stats
  total_submissions: number;
  by_source: Record<string, number>;
  by_action: Record<string, number>;
  by_decision: Record<string, number>;
  total_listens: number;
  total_approvals: number;
  total_playlists: number;

  // Breakdowns
  by_artist: ArtistPromoStats[];
  by_album: AlbumPromoStats[];
}

export interface PromoSubmissionsListResponse {
  submissions: PromoSubmission[];
  total_count: number;
  page: number;
  page_size: number;
}

export async function analyzeSubmitHubCSV(file: File): Promise<SubmitHubAnalyzeResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return fetchApi<SubmitHubAnalyzeResponse>('/promo/import/submithub/analyze', {
    method: 'POST',
    body: formData,
  });
}

export async function importSubmitHubCSV(
  file: File,
  artistId?: string,
  campaignName?: string,
  budget?: string
): Promise<ImportSubmitHubResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (artistId) formData.append('artist_id', artistId);
  if (campaignName) formData.append('campaign_name', campaignName);
  if (budget) formData.append('budget', budget);

  return fetchApi<ImportSubmitHubResponse>('/promo/import/submithub', {
    method: 'POST',
    body: formData,
  });
}

export async function analyzeGrooverCSV(file: File): Promise<GrooverAnalyzeResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return fetchApi<GrooverAnalyzeResponse>('/promo/import/groover/analyze', {
    method: 'POST',
    body: formData,
  });
}

export async function importGrooverCSV(
  file: File,
  artistId?: string,
  campaignName?: string,
  budget?: string
): Promise<ImportGrooverResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (artistId) formData.append('artist_id', artistId);
  if (campaignName) formData.append('campaign_name', campaignName);
  if (budget) formData.append('budget', budget);

  return fetchApi<ImportGrooverResponse>('/promo/import/groover', {
    method: 'POST',
    body: formData,
  });
}

export async function getPromoSubmissions(params?: {
  artist_id?: string;
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<PromoSubmissionsListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.artist_id) queryParams.set('artist_id', params.artist_id);
  if (params?.source) queryParams.set('source', params.source);
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.offset) queryParams.set('offset', params.offset.toString());

  const query = queryParams.toString();
  return fetchApi<PromoSubmissionsListResponse>(`/promo/submissions${query ? `?${query}` : ''}`);
}

export async function getPromoStats(artistId?: string): Promise<PromoStats> {
  const query = artistId ? `?artist_id=${artistId}` : '';
  return fetchApi<PromoStats>(`/promo/stats${query}`);
}

export async function getDetailedPromoStats(): Promise<DetailedPromoStats> {
  return fetchApi<DetailedPromoStats>('/promo/stats/detailed');
}

export async function getTracksSummary(params?: {
  artist_id?: string;
  release_upc?: string;
}): Promise<TracksSummaryResponse> {
  const queryParams = new URLSearchParams();
  if (params?.artist_id) queryParams.set('artist_id', params.artist_id);
  if (params?.release_upc) queryParams.set('release_upc', params.release_upc);

  const query = queryParams.toString();
  return fetchApi<TracksSummaryResponse>(`/promo/tracks-summary${query ? `?${query}` : ''}`);
}

export async function deletePromoSubmission(submissionId: string): Promise<void> {
  await fetchApi(`/promo/submissions/${submissionId}`, {
    method: 'DELETE',
  });
}

// Export functions
export function getExportCsvUrl(periodStart: string, periodEnd: string): string {
  return `${API_BASE}/exports/royalties/csv?period_start=${periodStart}&period_end=${periodEnd}`;
}

export function getExportPdfUrl(periodStart: string, periodEnd: string): string {
  return `${API_BASE}/exports/royalties/pdf?period_start=${periodStart}&period_end=${periodEnd}`;
}

export async function downloadExport(url: string, filename: string): Promise<void> {
  const res = await fetch(url, {
    headers: { 'X-Admin-Token': ADMIN_TOKEN },
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
