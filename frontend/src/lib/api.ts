import type {
  ImportRecord,
  ImportSource,
  PreviewResponse,
  ColumnMapping,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const headers: HeadersInit = {
    ...options?.headers,
  };

  // Add admin token if using FastAPI backend
  if (ADMIN_TOKEN && !API_BASE.includes('/api')) {
    (headers as Record<string, string>)['X-Admin-Token'] = ADMIN_TOKEN;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Erreur serveur' }));
    throw new Error(error.detail || `Erreur ${res.status}`);
  }

  return res.json();
}

export async function getImports(): Promise<ImportRecord[]> {
  return fetchApi<ImportRecord[]>('/imports');
}

export async function createImport(
  file: File,
  source: ImportSource,
  periodStart: string,
  periodEnd: string
): Promise<ImportRecord> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('source', source);
  formData.append('period_start', periodStart);
  formData.append('period_end', periodEnd);

  return fetchApi<ImportRecord>('/imports', {
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
