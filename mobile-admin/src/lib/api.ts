import Constants from 'expo-constants';
import { clearFetchCache } from '@/lib/useFetch';

const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://api.whalesrecords.com';

// ---------------------------------------------------------------------------
// Auth — the AuthProvider registers a token provider that returns a valid
// (refreshed-if-needed) Supabase access token. The token is sent as Bearer;
// the backend validates it and checks the email against ADMIN_EMAILS.
// ---------------------------------------------------------------------------
let _token: string | null = null;
let _tokenProvider: (() => Promise<string | null>) | null = null;

export function setAuthToken(token: string | null) {
  _token = token;
}
export function setTokenProvider(fn: (() => Promise<string | null>) | null) {
  _tokenProvider = fn;
}
export function getApiUrl(): string {
  return API_URL;
}

async function currentToken(): Promise<string | null> {
  if (_tokenProvider) {
    try {
      return await _tokenProvider();
    } catch {
      return _token;
    }
  }
  return _token;
}

// ---------------------------------------------------------------------------
// In-memory GET cache — 5 min TTL.
// ---------------------------------------------------------------------------
interface CacheEntry { data: unknown; ts: number }
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL = 300_000;

function cacheGet<T>(key: string): T | null {
  const e = _cache.get(key);
  if (e && Date.now() - e.ts < CACHE_TTL) return e.data as T;
  return null;
}
function cacheSet(key: string, data: unknown) {
  _cache.set(key, { data, ts: Date.now() });
}
export function invalidateCache(prefix?: string) {
  if (!prefix) { _cache.clear(); return; }
  for (const k of Array.from(_cache.keys())) {
    if (k.startsWith(prefix)) _cache.delete(k);
  }
}

// ---------------------------------------------------------------------------
// Global in-flight request tracker — drives the top progress bar.
// ---------------------------------------------------------------------------
let _inflight = 0;
const _loadingListeners = new Set<(loading: boolean) => void>();
function _emitLoading() {
  const v = _inflight > 0;
  _loadingListeners.forEach((cb) => cb(v));
}
export function subscribeLoading(cb: (loading: boolean) => void): () => void {
  _loadingListeners.add(cb);
  cb(_inflight > 0);
  return () => { _loadingListeners.delete(cb); };
}

type ReqOptions = { method?: string; headers?: Record<string, string>; body?: string };

async function fetchApi<T>(endpoint: string, options: ReqOptions = {}): Promise<T> {
  const isGet = !options.method || options.method === 'GET';

  if (isGet) {
    const hit = cacheGet<T>(endpoint);
    if (hit !== null) return hit;
  }

  const token = await currentToken();
  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  _inflight++;
  _emitLoading();
  try {
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Erreur serveur' }));
      throw new Error((error as { detail?: string }).detail || 'Erreur serveur');
    }
    let data: unknown = null;
    try { data = await res.json(); } catch { data = null; } // tolerate empty bodies (204)
    if (isGet) cacheSet(endpoint, data);
    return data as T;
  } finally {
    _inflight--;
    _emitLoading();
  }
}

// ============================ Types ============================
export interface MonthlyRevenue { month: number; year: number; month_label: string; gross: string; source_breakdown: Record<string, string> }
export interface MonthlyExpense { month: number; year: number; month_label: string; amount: string; category_breakdown: Record<string, string> }
export interface SourceRevenue { source: string; source_label: string; gross: string; transaction_count: number }
export interface CategoryExpense { category: string; category_label: string; amount: string; count: number }
export interface RoyaltiesPayable { period_start: string; period_end: string; net_payable: string; status: string }
export interface AnalyticsSummary {
  total_revenue: string; total_expenses: string; total_royalties_payable: string; total_outflow: string;
  net: string; currency: string;
  monthly_revenue: MonthlyRevenue[]; monthly_expenses: MonthlyExpense[];
  revenue_by_source: SourceRevenue[]; expenses_by_category: CategoryExpense[]; royalties_payable: RoyaltiesPayable[];
}

export interface FinancesSummary {
  total_expenses: string; total_royalties_payable: string; expenses_count: number;
  royalty_runs_count: number; currency: string;
}
export interface ExpenseResponse {
  id: string; artist_id?: string | null; artist_name?: string | null; entry_type: string;
  amount: string; currency: string; scope: string; scope_id?: string | null; scope_title?: string | null;
  category?: string | null; category_label?: string | null; royalty_run_id?: string | null;
  description?: string | null; reference?: string | null; document_url?: string | null;
  effective_date: string; created_at: string;
}
export interface RoyaltyPaymentResponse {
  run_id: string; period_start: string; period_end: string; total_net_payable: string;
  total_artist_royalties: string; total_recouped: string; status: string;
  locked_at?: string | null; artists_count: number;
}

export interface ArtistSummary {
  id: string; name: string; external_id?: string | null; spotify_id?: string | null;
  image_url?: string | null; image_url_small?: string | null; created_at?: string | null;
  total_gross: string; total_streams: number; transaction_count: number; has_collaborations: boolean;
}
export interface ArtistDetail {
  id: string; name: string; category: string; external_id?: string | null; spotify_id?: string | null;
  image_url?: string | null; image_url_small?: string | null;
  instagram_url?: string | null; twitter_url?: string | null; facebook_url?: string | null;
  tiktok_url?: string | null; youtube_url?: string | null; access_code?: string | null;
  email?: string | null; created_at: string;
}
export interface AdvanceBalance {
  artist_id: string; balance: string; currency: string;
  total_advances: string; total_recouped: string; total_payments: string;
}

export interface RoyaltyRunArtist {
  artist_id: string; artist_name: string; gross: string; artist_royalties: string;
  recouped: string; net_payable: string; transaction_count: number;
  statement_id?: string | null; statement_status?: string | null; paid_at?: string | null;
}
export interface RoyaltyRun {
  run_id: string; period_start: string; period_end: string; base_currency: string; status: string;
  is_locked: boolean; total_transactions: number; total_gross: string; total_artist_royalties: string;
  total_label_royalties: string; total_recouped: string; total_net_payable: string;
  artists: RoyaltyRunArtist[]; import_ids: string[]; created_at: string;
  completed_at?: string | null; locked_at?: string | null;
}

export interface TicketListItem {
  id: string; ticket_number: string; subject: string; category: string; category_label: string;
  status: string; status_label: string; priority: string; priority_label: string;
  artist_names: string[]; unread_count: number; last_message_at: string; created_at: string;
}
export interface TicketStats { total: number; open: number; in_progress: number; resolved: number; closed: number; by_category: Record<string, number> }
export interface TicketMessage {
  id: string; message: string; sender_type: string; sender_name?: string | null;
  is_internal: boolean; created_at: string;
}
export interface TicketDetail {
  id: string; ticket_number: string; subject: string; category: string; category_label: string;
  status: string; status_label: string; priority: string; priority_label: string; assigned_to?: string | null;
  messages: TicketMessage[]; participants: string[]; created_at: string; updated_at: string;
  resolved_at?: string | null; closed_at?: string | null;
}

export interface InventorySummary {
  total_products: number; total_stock: number; low_stock_count: number;
  total_value: number; by_format: Record<string, number>; by_status: Record<string, number>;
}
export interface Product {
  id: string; title: string; format: string; variant?: string | null; sku?: string | null;
  release_upc?: string | null; artist_name?: string | null; price_eur?: number | null; cost_eur?: number | null;
  stock_quantity: number; initial_stock_quantity: number; low_stock_threshold: number; status: string;
  limited_edition: boolean; edition_size?: number | null; image_url?: string | null; notes?: string | null;
  total_sold: number; created_at: string; updated_at: string;
}

export interface LabelSettings {
  id?: string; label_name?: string; logo_url?: string | null; logo_base64?: string | null; logo_dark_base64?: string | null;
  address_line1?: string | null; address_line2?: string | null; city?: string | null; postal_code?: string | null;
  country?: string | null; email?: string | null; phone?: string | null; website?: string | null;
  siret?: string | null; vat_number?: string | null;
}

export interface PromoStats {
  total_submissions: number; by_source: Record<string, number>; by_action: Record<string, number>;
  by_decision: Record<string, number>; total_listens: number; total_approvals: number; total_playlists: number;
}
export interface ArtistPromoStats {
  artist_id: string; artist_name: string; total_submissions: number; total_listened: number;
  total_approved: number; total_declined: number; total_shared: number; total_playlists: number; approval_rate: number;
}
export interface AlbumPromoStats extends ArtistPromoStats { release_upc?: string | null; release_title: string }
export interface DetailedPromoStats extends PromoStats { by_artist: ArtistPromoStats[]; by_album: AlbumPromoStats[] }

export interface PromoSubmission {
  id: string; artist_id: string; release_upc?: string | null; track_isrc?: string | null; song_title: string;
  source: string; campaign_id?: string | null; campaign_url?: string | null; outlet_name?: string | null;
  outlet_type?: string | null; action?: string | null; listen_time?: number | null; influencer_name?: string | null;
  influencer_type?: string | null; decision?: string | null; sharing_link?: string | null; feedback?: string | null;
  submitted_at?: string | null; responded_at?: string | null; created_at: string; updated_at: string;
  artist_name?: string | null; release_title?: string | null;
}
export interface PromoSubmissionsList { submissions: PromoSubmission[]; total_count: number; page: number; page_size: number }

export interface AdCampaign {
  id: string; artist_id: string; artist_name?: string | null; campaign_name: string;
  release_name?: string | null; release_upc?: string | null; track_isrc?: string | null;
  ad_format?: string | null; release_type?: string | null; country?: string | null; currency: string;
  budget?: string | null; spend?: string | null; start_date?: string | null; end_date?: string | null;
  reach?: number | null; clicks?: number | null; amplified_listeners?: number | null; reactivated_listeners?: number | null;
  new_active_listeners?: number | null; converted_listeners?: number | null; conversion_rate?: string | null;
  active_streams_per_listener?: string | null; intent_rate?: string | null; playlist_adds?: number | null;
  playlist_add_rate?: string | null; saves?: number | null; save_rate?: string | null;
  listeners_other_releases?: number | null; streams_per_listener_other_releases?: string | null;
  saves_other_releases?: number | null; playlist_adds_other_releases?: number | null;
}
export interface AdCampaignsList { campaigns: AdCampaign[]; count: number; total_spend: string; currency: string }

export interface ContractParty {
  id: string; contract_id: string; party_type: string; artist_id?: string | null;
  label_name?: string | null; share_percentage: string | number;
  share_physical?: string | number | null; share_digital?: string | number | null;
  contact_email?: string | null; contact_phone?: string | null; created_at: string;
}
export interface ContractListItem {
  id: string; artist_id: string; scope: string; scope_id?: string | null;
  start_date: string; end_date?: string | null; parties: ContractParty[];
  artist_share?: string | number | null; label_share?: string | number | null;
}
export interface ContractDetail extends ContractListItem {
  description?: string | null; document_url?: string | null; created_at: string; updated_at: string;
}

// ============================ API ============================
export const getAnalyticsSummary = (year: number) => fetchApi<AnalyticsSummary>(`/analytics/summary?year=${year}`);

export interface ImportItem {
  id: string; source: string; status: string; period_start: string; period_end: string;
  filename?: string | null; total_rows: number; success_rows: number; error_rows: number; created_at: string;
}
export const getImports = (limit = 20) => fetchApi<ImportItem[]>(`/imports?limit=${limit}`);

// ---- Expenses (create / update / delete) ----
export interface ExpenseInput {
  artist_id?: string | null; amount?: string; currency?: string; scope?: string;
  scope_id?: string | null; category?: string | null; description?: string | null;
  reference?: string | null; effective_date?: string | null;
}
function bustFinances() {
  invalidateCache('/finances'); invalidateCache('/analytics');
  clearFetchCache('expenses'); clearFetchCache('fin-summary'); clearFetchCache('analytics:');
}
export async function createExpense(input: ExpenseInput): Promise<ExpenseResponse> {
  const r = await fetchApi<ExpenseResponse>('/finances/expenses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  bustFinances();
  return r;
}
export async function updateExpense(id: string, input: ExpenseInput): Promise<ExpenseResponse> {
  const r = await fetchApi<ExpenseResponse>(`/finances/expenses/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  bustFinances();
  return r;
}
export async function deleteExpense(id: string): Promise<void> {
  await fetchApi(`/finances/expenses/${id}`, { method: 'DELETE' });
  bustFinances();
}

// ---- Products (create / update / delete / stock) ----
export interface ProductInput {
  title?: string; format?: string; variant?: string | null; sku?: string | null;
  release_upc?: string | null; artist_name?: string | null; price_eur?: number | null; cost_eur?: number | null;
  stock_quantity?: number; initial_stock_quantity?: number; low_stock_threshold?: number; status?: string;
  limited_edition?: boolean; edition_size?: number | null; image_url?: string | null; notes?: string | null;
}
export interface StockAdjustInput { quantity: number; movement_type?: string; reason?: string | null; source?: string | null }
function bustInventory() {
  invalidateCache('/inventory'); clearFetchCache('products'); clearFetchCache('inv-summary');
}
export async function createProduct(input: ProductInput): Promise<Product> {
  const r = await fetchApi<Product>('/inventory/products', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  bustInventory();
  return r;
}
export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const r = await fetchApi<Product>(`/inventory/products/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  bustInventory();
  return r;
}
export async function deleteProduct(id: string): Promise<void> {
  await fetchApi(`/inventory/products/${id}`, { method: 'DELETE' });
  bustInventory();
}
export async function adjustStock(id: string, input: StockAdjustInput): Promise<Product> {
  const r = await fetchApi<Product>(`/inventory/products/${id}/stock`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  bustInventory();
  return r;
}
export const getFinancesSummary = () => fetchApi<FinancesSummary>('/finances/summary');
export const getExpenses = () => fetchApi<ExpenseResponse[]>('/finances/expenses');
export const getRoyaltyPayments = () => fetchApi<RoyaltyPaymentResponse[]>('/finances/royalty-payments');

export const getArtistsSummary = () => fetchApi<ArtistSummary[]>('/artists/summary');
export const getArtist = (id: string) => fetchApi<ArtistDetail>(`/artists/${id}`);
export const getAdvanceBalance = (id: string) => fetchApi<AdvanceBalance>(`/artists/${id}/advance-balance`);

export const getRoyaltyRuns = (limit = 50, offset = 0) =>
  fetchApi<RoyaltyRun[]>(`/royalty-runs?limit=${limit}&offset=${offset}`);
export const getRoyaltyRun = (id: string) => fetchApi<RoyaltyRun>(`/royalty-runs/${id}`);

export const getTickets = (status?: string) =>
  fetchApi<TicketListItem[]>(`/tickets${status ? `?status=${status}` : ''}`);
export const getTicketStats = () => fetchApi<TicketStats>('/tickets/stats');
export const getTicket = (id: string) => fetchApi<TicketDetail>(`/tickets/${id}`);
export async function replyToTicket(id: string, message: string): Promise<TicketMessage> {
  const r = await fetchApi<TicketMessage>(`/tickets/${id}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }),
  });
  invalidateCache('/tickets');
  return r;
}

export const getInventorySummary = () => fetchApi<InventorySummary>('/inventory/summary');
export const getProducts = () => fetchApi<Product[]>('/inventory/products');

export const getLabelSettings = () => fetchApi<LabelSettings>('/settings/label');

export const getPromoStats = () => fetchApi<PromoStats>('/promo/stats');
export const getDetailedPromoStats = () => fetchApi<DetailedPromoStats>('/promo/stats/detailed');
export const getPromoSubmissions = (limit = 50, offset = 0) =>
  fetchApi<PromoSubmissionsList>(`/promo/submissions?limit=${limit}&offset=${offset}`);
export const getAdCampaigns = () => fetchApi<AdCampaignsList>('/promo/ad-campaigns');

export const getContracts = (artistId?: string, scope?: string) => {
  const p: string[] = [];
  if (artistId) p.push(`artist_id=${artistId}`);
  if (scope) p.push(`scope=${scope}`);
  return fetchApi<ContractListItem[]>(`/contracts${p.length ? `?${p.join('&')}` : ''}`);
};
export const getContract = (id: string) => fetchApi<ContractDetail>(`/contracts/${id}`);

export interface ContractPartyInput {
  party_type: string; artist_id?: string | null; label_name?: string | null;
  share_percentage: number; share_physical?: number | null; share_digital?: number | null;
  contact_email?: string | null; contact_phone?: string | null;
}
export interface ContractCreateInput {
  scope: string; scope_id?: string | null; start_date: string; end_date?: string | null;
  description?: string | null; artist_id: string; parties: ContractPartyInput[];
}
export interface ContractUpdateInput {
  start_date?: string; end_date?: string | null; description?: string | null; parties?: ContractPartyInput[];
}

function bustContracts(id?: string) {
  invalidateCache('/contracts');
  clearFetchCache('contracts:');
  if (id) clearFetchCache(`contract:${id}`);
}
export async function createContract(input: ContractCreateInput): Promise<ContractDetail> {
  const r = await fetchApi<ContractDetail>('/contracts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  bustContracts();
  return r;
}
export async function updateContract(id: string, input: ContractUpdateInput): Promise<ContractDetail> {
  const r = await fetchApi<ContractDetail>(`/contracts/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  bustContracts(id);
  return r;
}
export async function deleteContract(id: string): Promise<void> {
  await fetchApi(`/contracts/${id}`, { method: 'DELETE' });
  bustContracts(id);
}
