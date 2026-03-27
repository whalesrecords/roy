import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Serve the label logo as an image (for favicon / app icon)
export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/artist-portal/label-settings`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error('Failed to fetch label settings');
    const data = await res.json();

    const logoBase64: string | null = data.logo_base64;
    if (logoBase64 && logoBase64.startsWith('data:')) {
      const [header, b64] = logoBase64.split(',');
      const mimeMatch = header.match(/data:([^;]+)/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const buffer = Buffer.from(b64, 'base64');
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    if (data.logo_url) {
      return NextResponse.redirect(data.logo_url);
    }
  } catch {
    // Fall through to default
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="20" fill="#6366f1"/>
    <text x="50" y="67" font-size="50" text-anchor="middle" fill="white">🐋</text>
  </svg>`;
  return new NextResponse(svg, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=60' },
  });
}
