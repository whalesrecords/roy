const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('artist-token');
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Erreur serveur' }));
    throw new Error(error.detail || 'Erreur serveur');
  }

  return res.json();
}

// Types
export interface ArtistDashboard {
  artist: {
    id: string;
    name: string;
    artwork_url?: string;
  };
  total_gross: string;
  total_net: string;
  total_streams: number;
  advance_balance: string;
  currency: string;
  release_count: number;
  track_count: number;
}

export interface ArtistRevenue {
  period: string;
  gross: string;
  net: string;
  streams: number;
  currency: string;
}

export interface ArtistRelease {
  upc: string;
  title: string;
  artwork_url?: string;
  gross: string;
  net: string;
  streams: number;
  track_count: number;
  currency: string;
}

export interface ArtistTrack {
  isrc: string;
  title: string;
  release_title?: string;
  gross: string;
  net: string;
  streams: number;
  currency: string;
}

export interface ArtistPayment {
  id: string;
  amount: string;
  currency: string;
  date: string;
  description?: string;
}

export interface PlatformStats {
  platform: string;
  platform_label: string;
  gross: string;
  streams: number;
  percentage: number;
}

export interface Expense {
  id: string;
  amount: string;
  currency: string;
  category?: string;
  category_label?: string;
  scope: string;
  scope_title?: string;
  description?: string;
  date: string;
}

export interface Contract {
  id: string;
  scope: string;
  scope_id?: string;
  scope_title?: string;
  start_date: string;
  end_date?: string;
  artist_share: number;
  label_share: number;
  description?: string;
}

export interface QuarterlyRevenue {
  quarter: string;
  year: number;
  gross: string;
  net: string;
  streams: number;
  currency: string;
}

export interface LabelSettings {
  label_name?: string;
  label_logo_url?: string;
  logo_url?: string;
  logo_base64?: string;
}

export interface Statement {
  id: string;
  period_start: string;
  period_end: string;
  period_label: string;
  gross_revenue: string;
  artist_royalties: string;
  recouped: string;
  net_payable: string;
  currency: string;
  status: string;
  created_at: string;
}

export interface StatementReleaseDetail {
  upc: string;
  title: string;
  gross: string;
  artist_royalties: string;
  track_count: number;
}

export interface StatementSourceDetail {
  source: string;
  source_label: string;
  gross: string;
  artist_royalties: string;
  transaction_count: number;
}

export interface StatementDetail extends Statement {
  advance_balance: string;
  releases: StatementReleaseDetail[];
  sources: StatementSourceDetail[];
}

// API Functions
export async function getArtistDashboard(): Promise<ArtistDashboard> {
  return fetchApi<ArtistDashboard>('/artist-portal/dashboard');
}

export async function getArtistRevenue(year?: number): Promise<ArtistRevenue[]> {
  const params = year ? `?year=${year}` : '';
  return fetchApi<ArtistRevenue[]>(`/artist-portal/revenue${params}`);
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

export async function getPlatformStats(year?: number): Promise<PlatformStats[]> {
  const params = year ? `?year=${year}` : '';
  return fetchApi<PlatformStats[]>(`/artist-portal/platforms${params}`);
}

export async function getExpenses(): Promise<Expense[]> {
  return fetchApi<Expense[]>('/artist-portal/expenses');
}

export async function getContracts(): Promise<Contract[]> {
  return fetchApi<Contract[]>('/artist-portal/contracts');
}

export async function getQuarterlyRevenue(year?: number): Promise<QuarterlyRevenue[]> {
  const params = year ? `?year=${year}` : '';
  return fetchApi<QuarterlyRevenue[]>(`/artist-portal/revenue-quarterly${params}`);
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

// Profile Types
export interface ArtistProfile {
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  bank_name?: string;
  account_holder?: string;
  iban?: string;
  bic?: string;
  siret?: string;
  vat_number?: string;
}

// Profile API Functions
export async function getProfile(): Promise<ArtistProfile> {
  return fetchApi<ArtistProfile>('/artist-portal/profile');
}

export async function updateProfile(data: Partial<ArtistProfile>): Promise<ArtistProfile> {
  return fetchApi<ArtistProfile>('/artist-portal/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// Social Media Types
export interface SocialMedia {
  instagram_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  tiktok_url?: string;
  youtube_url?: string;
}

// Social Media API Functions
export async function getSocialMedia(): Promise<SocialMedia> {
  return fetchApi<SocialMedia>('/artist-portal/social-media');
}

export async function updateSocialMedia(data: Partial<SocialMedia>): Promise<SocialMedia> {
  return fetchApi<SocialMedia>('/artist-portal/social-media', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function requestPayment(statementId: string, message?: string): Promise<{ message: string; statement_id: string }> {
  return fetchApi('/artist-portal/request-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statement_id: statementId, message }),
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
  messages: TicketMessage[];
  participants: string[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface CreateTicketRequest {
  subject: string;
  category: string;
  message: string;
}

export async function getMyTickets(params?: {
  status?: string;
  category?: string;
}): Promise<Ticket[]> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.set('status', params.status);
  if (params?.category) queryParams.set('category', params.category);

  const query = queryParams.toString();
  return fetchApi<Ticket[]>(`/artist-portal/tickets${query ? `?${query}` : ''}`);
}

export async function getMyTicketDetail(ticketId: string): Promise<TicketDetail> {
  return fetchApi<TicketDetail>(`/artist-portal/tickets/${ticketId}`);
}

export async function createMyTicket(data: CreateTicketRequest): Promise<TicketDetail> {
  return fetchApi<TicketDetail>('/artist-portal/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function addMyTicketMessage(ticketId: string, message: string): Promise<TicketMessage> {
  return fetchApi<TicketMessage>(`/artist-portal/tickets/${ticketId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
}

export async function closeMyTicket(ticketId: string): Promise<void> {
  await fetchApi(`/artist-portal/tickets/${ticketId}/close`, {
    method: 'PUT',
  });
}


// ============ Promo API ============

export interface PromoStats {
  total_submissions: number;
  total_listens: number;
  total_approvals: number;
  total_shares: number;
  total_playlists: number;
  by_source: Record<string, number>;
}

export interface PromoSubmission {
  id: string;
  song_title: string;
  source: string;
  outlet_name: string | null;
  outlet_type: string | null;
  influencer_name: string | null;
  influencer_type: string | null;
  action: string | null;
  decision: string | null;
  feedback: string | null;
  listen_time: number | null;
  submitted_at: string | null;
  responded_at: string | null;
  campaign_url: string | null;
  sharing_link: string | null;
  release_upc: string | null;
  track_isrc: string | null;
  release_title: string | null;
}

export async function getArtistPromoStats(): Promise<PromoStats> {
  return fetchApi<PromoStats>('/artist-portal/promo/stats');
}

export async function getArtistPromoSubmissions(params?: {
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<PromoSubmission[]> {
  const queryParams = new URLSearchParams();
  if (params?.source) queryParams.set('source', params.source);
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.offset) queryParams.set('offset', params.offset.toString());

  const query = queryParams.toString();
  return fetchApi<PromoSubmission[]>(`/artist-portal/promo/submissions${query ? `?${query}` : ''}`);
}

export interface CreateManualPromoRequest {
  song_title: string;
  outlet_name: string;
  link?: string;
  notes?: string;
}

export async function createManualPromoSubmission(data: CreateManualPromoRequest): Promise<PromoSubmission> {
  return fetchApi<PromoSubmission>('/artist-portal/promo/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}


// ============ Artist Notifications ============

export interface ArtistNotification {
  id: string;
  notification_type: string;
  title: string;
  message: string | null;
  link: string | null;
  data: string | null;
  is_read: boolean;
  created_at: string;
}

export async function getArtistNotifications(params?: {
  unread_only?: boolean;
  limit?: number;
}): Promise<ArtistNotification[]> {
  const queryParams = new URLSearchParams();
  if (params?.unread_only) queryParams.set("unread_only", "true");
  if (params?.limit) queryParams.set("limit", params.limit.toString());

  const query = queryParams.toString();
  return fetchApi<ArtistNotification[]>("/artist-portal/notifications" + (query ? "?" + query : ""));
}

export async function getUnreadNotificationsCount(): Promise<{ unread_count: number }> {
  return fetchApi<{ unread_count: number }>("/artist-portal/notifications/unread-count");
}

export async function markNotificationAsRead(notificationId: string): Promise<{ message: string }> {
  return fetchApi<{ message: string }>("/artist-portal/notifications/" + notificationId + "/read", {
    method: "PUT",
  });
}

export async function markAllNotificationsAsRead(): Promise<{ message: string }> {
  return fetchApi<{ message: string }>("/artist-portal/notifications/mark-all-read", {
    method: "PUT",
  });
}

