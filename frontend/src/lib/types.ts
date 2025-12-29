export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

export type ImportSource = 'tunecore' | 'believe' | 'cdbaby' | 'other';

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
  { value: 'believe', label: 'Believe' },
  { value: 'cdbaby', label: 'CD Baby' },
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
