/**
 * Server-side proxy for admin API calls.
 * The admin token never leaves the server — it's read from a
 * non-NEXT_PUBLIC_ environment variable and injected here.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

async function handler(req: Request, { params }: { params: { path: string[] } }) {
  const path = (await params).path.join('/');
  const url = new URL(req.url);
  const target = `${API_BASE}/${path}${url.search}`;

  const headers = new Headers(req.headers);
  headers.set('X-Admin-Token', ADMIN_TOKEN);
  // Don't forward host header
  headers.delete('host');
  // Remove Accept-Encoding so the backend returns plain (uncompressed) JSON.
  // Node.js fetch() decompresses automatically but keeps Content-Encoding
  // in the response headers, which causes the browser to double-decompress.
  headers.delete('accept-encoding');

  const res = await fetch(target, {
    method: req.method,
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    // @ts-expect-error — Next.js streams
    duplex: 'half',
  });

  // Strip hop-by-hop headers that must not be forwarded to the browser
  const responseHeaders = new Headers(res.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('transfer-encoding');
  responseHeaders.delete('connection');

  return new Response(res.body, {
    status: res.status,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
