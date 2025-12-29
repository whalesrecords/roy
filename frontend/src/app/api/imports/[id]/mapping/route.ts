import { NextRequest, NextResponse } from 'next/server';

const savedMappings: Record<string, unknown> = {};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { mappings } = body;

  if (!mappings || !Array.isArray(mappings)) {
    return NextResponse.json(
      { detail: 'Mappings invalides' },
      { status: 400 }
    );
  }

  savedMappings[params.id] = {
    mappings,
    saved_at: new Date().toISOString(),
  };

  console.log(`Mapping saved for import ${params.id}:`, mappings);

  return NextResponse.json({ success: true });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const mapping = savedMappings[params.id];

  if (!mapping) {
    return NextResponse.json(
      { detail: 'Mapping non trouvé' },
      { status: 404 }
    );
  }

  return NextResponse.json(mapping);
}
