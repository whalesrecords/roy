export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

export type ImportSource = 'tunecore' | 'believe_uk' | 'believe_fr' | 'cdbaby' | 'bandcamp' | 'other';

export interface ImportRecord {
  id: string;
  source: ImportSource;
  status: ImportStatus;
  period_start: string;
  period_end: string;
  filename: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  errors: ImportError[];
  created_at: string;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface CreateImportResponse {
  import_id: string;
  status: string;
  rows_parsed: number;
  rows_inserted: number;
  gross_total: string;
  errors_count: number;
  sample_errors: Array<{
    row_number: number;
    error: string;
    raw_data?: Record<string, unknown>;
  }>;
}

export interface PreviewRow {
  [key: string]: string;
}

export interface PreviewResponse {
  columns: string[];
  rows: PreviewRow[];
  total_rows: number;
}

export interface ColumnMapping {
  source_column: string;
  target_field: NormalizedField | null;
}

export type NormalizedField =
  | 'artist_name'
  | 'track_title'
  | 'release_title'
  | 'isrc'
  | 'upc'
  | 'territory'
  | 'store'
  | 'sale_type'
  | 'quantity'
  | 'gross_amount'
  | 'currency'
  | 'period_start'
  | 'period_end';

export const NORMALIZED_FIELDS: { value: NormalizedField; label: string }[] = [
  { value: 'artist_name', label: 'Artiste' },
  { value: 'track_title', label: 'Titre du morceau' },
  { value: 'release_title', label: 'Album / Release' },
  { value: 'isrc', label: 'ISRC' },
  { value: 'upc', label: 'UPC' },
  { value: 'territory', label: 'Pays' },
  { value: 'store', label: 'Plateforme' },
  { value: 'sale_type', label: 'Type de vente' },
  { value: 'quantity', label: 'Quantité' },
  { value: 'gross_amount', label: 'Montant brut' },
  { value: 'currency', label: 'Devise' },
  { value: 'period_start', label: 'Début période' },
  { value: 'period_end', label: 'Fin période' },
];

export const SOURCES: { value: ImportSource; label: string }[] = [
  { value: 'tunecore', label: 'TuneCore' },
  { value: 'believe_uk', label: 'Believe UK' },
  { value: 'believe_fr', label: 'Believe FR' },
  { value: 'cdbaby', label: 'CD Baby' },
  { value: 'bandcamp', label: 'Bandcamp' },
  { value: 'other', label: 'Autre' },
];

export const STATUS_LABELS: Record<ImportStatus, string> = {
  pending: 'En attente',
  processing: 'En cours',
  completed: 'Terminé',
  failed: 'Échoué',
  partial: 'Partiel',
};

export const STATUS_COLORS: Record<ImportStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  partial: 'bg-yellow-100 text-yellow-700',
};

// Artists
export interface Artist {
  id: string;
  name: string;
  external_id?: string;
  spotify_id?: string;
  image_url?: string;
  image_url_small?: string;
  created_at: string;
}

// Spotify
export interface SpotifySearchResult {
  spotify_id?: string;
  name?: string;
  image_url?: string;
  image_url_small?: string;
  popularity?: number;
  genres?: string[];
}

export interface Contract {
  id: string;
  artist_id: string;
  scope: 'track' | 'release' | 'catalog';
  scope_id?: string;
  artist_share: string;
  label_share: string;
  start_date: string;
  end_date?: string;
  description?: string;
  created_at: string;
}

export type ExpenseCategory =
  | 'mastering'
  | 'mixing'
  | 'recording'
  | 'photos'
  | 'video'
  | 'advertising'
  | 'groover'
  | 'submithub'
  | 'google_ads'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'spotify_ads'
  | 'pr'
  | 'distribution'
  | 'artwork'
  | 'other';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'mastering', label: 'Mastering' },
  { value: 'mixing', label: 'Mixage' },
  { value: 'recording', label: 'Enregistrement' },
  { value: 'photos', label: 'Photos' },
  { value: 'video', label: 'Vidéo' },
  { value: 'advertising', label: 'Publicité' },
  { value: 'groover', label: 'Groover' },
  { value: 'submithub', label: 'SubmitHub' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'spotify_ads', label: 'Spotify Ads' },
  { value: 'pr', label: 'PR / Relations presse' },
  { value: 'distribution', label: 'Distribution' },
  { value: 'artwork', label: 'Artwork' },
  { value: 'other', label: 'Autre' },
];

export interface AdvanceEntry {
  id: string;
  artist_id: string;
  entry_type: 'advance' | 'recoupment';
  amount: string;
  currency: string;
  scope: 'track' | 'release' | 'catalog';
  scope_id?: string;
  category?: ExpenseCategory;
  royalty_run_id?: string;
  description?: string;
  reference?: string;
  effective_date: string;
  created_at: string;
}

// Royalties
export type RoyaltyRunStatus = 'draft' | 'processing' | 'completed' | 'locked' | 'failed';

export interface RoyaltyRun {
  run_id: string;
  period_start: string;
  period_end: string;
  base_currency: string;
  status: RoyaltyRunStatus;
  is_locked: boolean;
  total_transactions: number;
  total_gross: string;
  total_artist_royalties: string;
  total_label_royalties: string;
  total_recouped: string;
  total_net_payable: string;
  artists: ArtistRoyaltyResult[];
  import_ids: string[];
  created_at: string;
  completed_at?: string;
  locked_at?: string;
}

export interface ArtistRoyaltyResult {
  artist_id: string;
  artist_name: string;
  gross: string;
  artist_royalties: string;
  recouped: string;
  net_payable: string;
  transaction_count: number;
}

export const ROYALTY_STATUS_LABELS: Record<RoyaltyRunStatus, string> = {
  draft: 'Brouillon',
  processing: 'En cours',
  completed: 'Terminé',
  locked: 'Verrouillé',
  failed: 'Échoué',
};

export const ROYALTY_STATUS_COLORS: Record<RoyaltyRunStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  locked: 'bg-purple-100 text-purple-700',
  failed: 'bg-red-100 text-red-700',
};
