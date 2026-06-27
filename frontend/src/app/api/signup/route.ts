/**
 * Same-origin forwarder for self-service label signup.
 *
 * Unlike /api/proxy (which injects the shared admin token), this route forwards
 * the signing-up user's own Supabase Bearer token to the backend's
 * POST /labels/signup. Same-origin → no CORS; the admin token is never used.
 */
export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  const body = await req.text();

  const res = await fetch(`${API_BASE}/labels/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body,
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
