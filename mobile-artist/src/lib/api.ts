import Constants from 'expo-constants';

const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://api.whalesrecords.com';

// ---------------------------------------------------------------------------
// Auth token — held in memory, set at boot/login from SecureStore.
// ---------------------------------------------------------------------------
let _token: string | null = null;
export function setAuthToken(token: string | null) {
  _token = token;
}
export function getApiUrl(): string {
  return API_URL;
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

  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;

  _inflight++;
  _emitLoading();
  try {
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Erreur serveur' }));
      throw new Error((error as { detail?: string }).detail || 'Erreur serveur');
    }
    const data = await res.json();
    if (isGet) cacheSet(endpoint, data);
    return data as T;
  } finally {
    _inflight--;
    _emitLoading();
  }
}

// ============================ Types ============================
export interface Artist { id: string; name: string; email?: string; artwork_url?: string }

export interface ArtistDashboard {
  artist: { id: string; name: string; artwork_url?: string };
  total_gross: string;
  total_net: string;
  total_streams: number;
  advance_balance: string;
  currency: string;
  release_count: number;
  track_count: number;
}

export interface ArtistRevenue { period: string; gross: string; net: string; streams: number; currency: string }

export interface ArtistRelease {
  upc: string; title: string; artwork_url?: string;
  gross: string; net: string; streams: number; track_count: number; currency: string;
}

export interface ArtistTrack {
  isrc: string; title: string; release_title?: string; artwork_url?: string;
  gross: string; net: string; streams: number; currency: string;
}

export interface ArtistPayment { id: string; amount: string; currency: string; date: string; description?: string }

export interface PlatformStats {
  platform: string; platform_label: string; gross: string; streams: number; percentage: number;
}

export interface Expense {
  id: string; amount: string; currency: string; category?: string; category_label?: string;
  scope: string; scope_title?: string; description?: string; date: string; document_url?: string;
}

export interface ContractPartyInfo {
  party_type: string; label_name?: string; share_percentage: string; contact_email?: string; contact_phone?: string;
}

export interface Contract {
  id: string; scope: string; scope_id?: string; scope_title?: string;
  start_date: string; end_date?: string; artist_share: number; label_share: number;
  description?: string; parties?: ContractPartyInfo[];
  signed?: boolean; signed_at?: string;
}

export interface SignatureStatus {
  contract_id: string; signed: boolean; signed_at?: string; signer_name?: string;
  document_hash?: string; has_certificate?: boolean; certificate_pdf?: string;
}

export interface QuarterlyRevenue { quarter: string; year: number; gross: string; net: string; streams: number; currency: string }

export interface LabelSettings {
  label_name?: string; label_logo_url?: string; logo_url?: string; logo_base64?: string; logo_dark_base64?: string;
}

export interface Statement {
  id: string; period_start: string; period_end: string; period_label: string;
  gross_revenue: string; artist_royalties: string; recouped: string; net_payable: string;
  currency: string; status: string; created_at: string;
}

export interface StatementReleaseDetail { upc: string; title: string; gross: string; artist_royalties: string; track_count: number }
export interface StatementSourceDetail { source: string; source_label: string; gross: string; artist_royalties: string; transaction_count: number }
export interface StatementDetail extends Statement {
  advance_balance: string; releases: StatementReleaseDetail[]; sources: StatementSourceDetail[];
}

export interface ArtistProfile {
  email?: string; phone?: string; address_line1?: string; address_line2?: string; city?: string;
  postal_code?: string; country?: string; bank_name?: string; account_holder?: string;
  iban?: string; bic?: string; siret?: string; vat_number?: string;
}

export interface SocialMedia {
  instagram_url?: string; twitter_url?: string; facebook_url?: string; tiktok_url?: string; youtube_url?: string;
}

export interface TicketMessage {
  id: string; message: string; sender_type: 'artist' | 'admin' | 'system';
  sender_name: string | null; is_internal: boolean; created_at: string;
}
export interface Ticket {
  id: string; ticket_number: string; subject: string; category: string; category_label: string;
  status: string; status_label: string; priority: string; unread_count: number; last_message_at: string; created_at: string;
}
export interface TicketDetail {
  id: string; ticket_number: string; subject: string; category: string; category_label: string;
  status: string; status_label: string; priority: string; priority_label: string;
  messages: TicketMessage[]; participants: string[]; created_at: string; updated_at: string; resolved_at: string | null;
}
export interface CreateTicketRequest { subject: string; category: string; message: string }

export interface PromoStats {
  total_submissions: number; total_listens: number; total_approvals: number;
  total_shares: number; total_playlists: number; by_source: Record<string, number>;
}
export interface PromoSubmission {
  id: string; song_title: string; source: string; outlet_name: string | null; outlet_type: string | null;
  influencer_name: string | null; influencer_type: string | null; action: string | null; decision: string | null;
  feedback: string | null; listen_time: number | null; submitted_at: string | null; responded_at: string | null;
  campaign_url: string | null; sharing_link: string | null; release_upc: string | null; track_isrc: string | null; release_title: string | null;
}
export interface CreateManualPromoRequest { song_title: string; outlet_name: string; link?: string; notes?: string }

export interface ArtistNotification {
  id: string; notification_type: string; title: string; message: string | null;
  link: string | null; data: string | null; is_read: boolean; created_at: string;
}

export interface ArtistAdCampaign {
  id: string; campaign_name: string; release_name?: string | null; track_isrc?: string | null; release_upc?: string | null;
  ad_format?: string | null; release_type?: string | null; country?: string | null; currency: string;
  budget?: string | null; spend?: string | null; start_date?: string | null; end_date?: string | null;
  reach?: number | null; clicks?: number | null; amplified_listeners?: number | null; reactivated_listeners?: number | null;
  new_active_listeners?: number | null; converted_listeners?: number | null; conversion_rate?: string | null;
  active_streams_per_listener?: string | null; intent_rate?: string | null; playlist_adds?: number | null;
  playlist_add_rate?: string | null; saves?: number | null; save_rate?: string | null;
  listeners_other_releases?: number | null; streams_per_listener_other_releases?: string | null;
  saves_other_releases?: number | null; playlist_adds_other_releases?: number | null;
}
export interface ArtistAdCampaignsResponse { campaigns: ArtistAdCampaign[]; count: number; total_spend: string; currency: string }

export interface MemberShare { artist_id: string | null; name: string; share_pct: number; net: string; available: string }
export interface MembersBreakdown { is_group: boolean; currency: string; total_net: string; available: string; members: MemberShare[] }

// ============================ Auth ============================
export interface LoginResult { token: string; artist: Artist }

export async function loginWithCode(code: string): Promise<LoginResult> {
  return fetchApi<LoginResult>('/artist-portal/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}
export async function loginWithEmail(email: string, password: string): Promise<LoginResult> {
  return fetchApi<LoginResult>('/artist-portal/login-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}
export async function getMe(): Promise<Artist> {
  return fetchApi<Artist>('/artist-portal/me');
}

// ============================ API Functions ============================
export async function getArtistDashboard(): Promise<ArtistDashboard> {
  return fetchApi<ArtistDashboard>('/artist-portal/dashboard');
}
export async function getArtistRevenue(year?: number): Promise<ArtistRevenue[]> {
  return fetchApi<ArtistRevenue[]>(`/artist-portal/revenue${year ? `?year=${year}` : ''}`);
}
export async function getArtistReleases(): Promise<ArtistRelease[]> {
  return fetchApi<ArtistRelease[]>('/artist-portal/releases');
}
export async function getArtistTracks(): Promise<ArtistTrack[]> {
  return fetchApi<ArtistTrack[]>('/artist-portal/tracks');
}
export async function getArtistPayments(): Promise<ArtistPayment[]> {
  return fetchApi<ArtistPayment[]>('/artist-portal/payments');
}
export async function getPlatformStats(year?: number, quarter?: number | null): Promise<PlatformStats[]> {
  const p: string[] = [];
  if (year) p.push(`year=${year}`);
  if (quarter) p.push(`quarter=${quarter}`);
  return fetchApi<PlatformStats[]>(`/artist-portal/platforms${p.length ? `?${p.join('&')}` : ''}`);
}
export async function getExpenses(): Promise<Expense[]> {
  return fetchApi<Expense[]>('/artist-portal/expenses');
}
export async function getContracts(): Promise<Contract[]> {
  return fetchApi<Contract[]>('/artist-portal/contracts');
}
export async function signContract(contractId: string, signatureImage: string, signerName?: string): Promise<SignatureStatus> {
  const r = await fetchApi<SignatureStatus>(`/artist-portal/contracts/${contractId}/sign`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature_image: signatureImage, consent: true, signer_name: signerName }),
  });
  invalidateCache('/artist-portal/contracts');
  return r;
}
export async function getContractSignature(contractId: string, withCert = false): Promise<SignatureStatus> {
  return fetchApi<SignatureStatus>(`/artist-portal/contracts/${contractId}/signature${withCert ? '?with_certificate=true' : ''}`);
}
export async function getAvailableYears(): Promise<{ years: number[]; default_year: number | null }> {
  return fetchApi('/artist-portal/available-years');
}
export async function getQuarterlyRevenue(year?: number): Promise<QuarterlyRevenue[]> {
  return fetchApi<QuarterlyRevenue[]>(`/artist-portal/revenue-quarterly${year ? `?year=${year}` : ''}`);
}
export async function getLabelSettings(): Promise<LabelSettings> {
  return fetchApi<LabelSettings>('/artist-portal/label-settings');
}
export async function getStatements(): Promise<Statement[]> {
  return fetchApi<Statement[]>('/artist-portal/statements');
}
export async function getStatementDetail(id: string): Promise<StatementDetail> {
  return fetchApi<StatementDetail>(`/artist-portal/statements/${id}`);
}
export async function getProfile(): Promise<ArtistProfile> {
  return fetchApi<ArtistProfile>('/artist-portal/profile');
}
export async function updateProfile(data: Partial<ArtistProfile>): Promise<ArtistProfile> {
  return fetchApi<ArtistProfile>('/artist-portal/profile', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
}
export async function requestPayment(statementId: string, message?: string): Promise<{ message: string; statement_id: string }> {
  return fetchApi('/artist-portal/request-payment', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statement_id: statementId, message }),
  });
}
export async function getMyTickets(params?: { status?: string; category?: string }): Promise<Ticket[]> {
  const p: string[] = [];
  if (params?.status) p.push(`status=${params.status}`);
  if (params?.category) p.push(`category=${params.category}`);
  return fetchApi<Ticket[]>(`/artist-portal/tickets${p.length ? `?${p.join('&')}` : ''}`);
}
export async function getMyTicketDetail(ticketId: string): Promise<TicketDetail> {
  return fetchApi<TicketDetail>(`/artist-portal/tickets/${ticketId}`);
}
export async function createMyTicket(data: CreateTicketRequest): Promise<TicketDetail> {
  return fetchApi<TicketDetail>('/artist-portal/tickets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
}
export async function addMyTicketMessage(ticketId: string, message: string): Promise<TicketMessage> {
  return fetchApi<TicketMessage>(`/artist-portal/tickets/${ticketId}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }),
  });
}
export async function getArtistPromoStats(): Promise<PromoStats> {
  return fetchApi<PromoStats>('/artist-portal/promo/stats');
}
export async function getArtistPromoSubmissions(params?: { source?: string; limit?: number; offset?: number }): Promise<PromoSubmission[]> {
  const p: string[] = [];
  if (params?.source) p.push(`source=${params.source}`);
  if (params?.limit) p.push(`limit=${params.limit}`);
  if (params?.offset) p.push(`offset=${params.offset}`);
  return fetchApi<PromoSubmission[]>(`/artist-portal/promo/submissions${p.length ? `?${p.join('&')}` : ''}`);
}
export async function getArtistAdCampaigns(): Promise<ArtistAdCampaignsResponse> {
  return fetchApi<ArtistAdCampaignsResponse>('/artist-portal/promo/ad-campaigns');
}
export async function getMembersBreakdown(): Promise<MembersBreakdown> {
  return fetchApi<MembersBreakdown>('/artist-portal/members-breakdown');
}
export async function getArtistNotifications(params?: { unread_only?: boolean; limit?: number }): Promise<ArtistNotification[]> {
  const p: string[] = [];
  if (params?.unread_only) p.push('unread_only=true');
  if (params?.limit) p.push(`limit=${params.limit}`);
  return fetchApi<ArtistNotification[]>(`/artist-portal/notifications${p.length ? `?${p.join('&')}` : ''}`);
}
