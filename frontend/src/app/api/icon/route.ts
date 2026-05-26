import { NextRequest, NextResponse } from 'next/server';

// This route fetches from the backend at runtime — never statically generated
export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Serve the label logo as an image (for favicon / app icon)
export async function GET(request: NextRequest) {
  try {
    const res = await fetch(`${API_BASE}/artist-portal/label-settings`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });
    if (!res.ok) throw new Error('Failed to fetch label settings');
    const data = await res.json();

    // logo_base64 is stored as a data URI (e.g. "data:image/png;base64,...")
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

    // Redirect to logo_url if set
    if (data.logo_url) {
      return NextResponse.redirect(data.logo_url);
    }
  } catch {
    // Fall through to default
  }

  // Default: serve the static Whales Records logo
  return NextResponse.redirect(new URL('/logo-black.png', request.url));
}
