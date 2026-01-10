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
