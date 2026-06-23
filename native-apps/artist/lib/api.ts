import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'roy.artist.token';

/**
 * Backend URL — defaults to production. Override per env via
 * EXPO_PUBLIC_API_URL in a .env file at the app root.
 */
const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://api.whalesrecords.com';

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body && !(init.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const detail =
      (data && typeof data === 'object' && 'detail' in data && typeof (data as { detail?: string }).detail === 'string'
        ? (data as { detail: string }).detail
        : null) || text || `HTTP ${res.status}`;
    throw new ApiError(res.status, detail, data);
  }
  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ── Domain endpoints (typed wrappers — extend as we wire more screens) ──

export interface AnalyticsSummary {
  year: number;
  total_revenue: string;
  total_expenses: string;
  total_royalties_payable: string;
  total_outflow: string;
  net: string;
  monthly_revenue: { month: number; year: number; gross: string }[];
  monthly_expenses: { month: number; year: number; amount: string }[];
  expenses_by_category: { category: string; category_label: string; amount: string; count: number }[];
}

export const getAnalyticsSummary = (year: number) =>
  api<AnalyticsSummary>(`/analytics/summary?year=${year}`);

export interface ArtistSummary {
  id: string;
  name: string;
  image_url?: string;
  image_url_small?: string;
  total_gross: string;
  total_streams: number;
  transaction_count: number;
  has_collaborations: boolean;
}

export const getArtistsSummary = () => api<ArtistSummary[]>('/artists/summary');

export interface RoyaltyRun {
  run_id: string;
  period_start: string;
  period_end: string;
  status: string;
  is_locked: boolean;
  total_net_payable: string;
  artists: {
    artist_id: string;
    artist_name: string;
    gross: string;
    net_payable: string;
    statement_status?: string;
  }[];
}

export const getRoyaltyRuns = () => api<RoyaltyRun[]>('/royalty-runs');
export const lockRoyaltyRun = (runId: string) =>
  api<RoyaltyRun>(`/royalty-runs/${runId}/lock`, { method: 'POST' });

// ── Artist-portal specific endpoints (override the admin ones above) ──

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
export const getArtistDashboard = () => api<ArtistDashboard>('/artist-portal/dashboard');

export interface PlatformStat {
  platform: string;
  platform_label: string;
  gross: string;
  streams: number;
  percentage: number;
}
export const getPlatformStats = (year?: number) =>
  api<PlatformStat[]>(`/artist-portal/platforms${year ? `?year=${year}` : ''}`);

export interface ArtistTrack {
  isrc: string;
  title: string;
  artwork_url?: string;
  gross: string;
  net: string;
  streams: number;
}
export const getArtistTracks = () => api<ArtistTrack[]>('/artist-portal/tracks');

export interface Statement {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  gross_revenue: string;
  artist_royalties: string;
  recouped: string;
  net_payable: string;
  status: string;
}
export const getStatements = () => api<Statement[]>('/artist-portal/statements');

export const getAvailableYears = () =>
  api<{ years: number[]; default_year: number | null }>('/artist-portal/years');
