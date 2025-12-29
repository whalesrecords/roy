import { NextRequest, NextResponse } from 'next/server';

const mockImports = [
  {
    id: '1',
    source: 'tunecore',
    status: 'completed',
    period_start: '2024-01-01',
    period_end: '2024-03-31',
    filename: 'tunecore_q1_2024.csv',
    total_rows: 15234,
    success_rows: 15200,
    error_rows: 34,
    errors: [
      { row: 142, field: 'isrc', message: 'Format ISRC invalide' },
      { row: 567, field: 'amount', message: 'Montant négatif' },
    ],
    created_at: '2024-04-02T10:30:00Z',
  },
  {
    id: '2',
    source: 'tunecore',
    status: 'processing',
    period_start: '2024-04-01',
    period_end: '2024-06-30',
    filename: 'tunecore_q2_2024.csv',
    total_rows: 18500,
    success_rows: 12000,
    error_rows: 0,
    errors: [],
    created_at: '2024-07-01T09:15:00Z',
  },
];

export async function GET() {
  return NextResponse.json(mockImports);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const source = formData.get('source') as string;
  const periodStart = formData.get('period_start') as string;
  const periodEnd = formData.get('period_end') as string;

  if (!file || !source || !periodStart || !periodEnd) {
    return NextResponse.json(
      { detail: 'Tous les champs sont requis' },
      { status: 400 }
    );
  }

  const newImport = {
    id: String(Date.now()),
    source,
    status: 'pending',
    period_start: periodStart,
    period_end: periodEnd,
    filename: file.name,
    total_rows: 0,
    success_rows: 0,
    error_rows: 0,
    errors: [],
    created_at: new Date().toISOString(),
  };

  return NextResponse.json(newImport);
}
