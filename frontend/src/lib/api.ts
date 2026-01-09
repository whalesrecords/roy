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
  category?: string
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
  category?: string
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
  physical_format?: string;
  store_name?: string;
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
  advance_balance: string;  // Scoped advances for this album
  recoupable: string;       // Amount deducted from this album
  net_payable: string;      // Net after scoped advance deduction
  included_in_upc?: string; // If this single is included in an album's recoupment
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
export type { Artist, Contract, AdvanceEntry, RoyaltyRun } from './types';

// ===== Contracts API =====

export interface ContractParty {
  id?: string;
  party_type: 'artist' | 'label';
  artist_id?: string;
  label_name?: string;
  share_percentage: number;
  created_at?: string;
}

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
