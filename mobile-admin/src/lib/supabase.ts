import Constants from 'expo-constants';

/**
 * Minimal Supabase GoTrue client (REST) — no @supabase/supabase-js dependency.
 * The admin app authenticates with email/password, receives a JWT, and sends it
 * as a Bearer token to the backend. The backend validates the JWT and checks the
 * user's email against the ADMIN_EMAILS allowlist (see app/core/auth.py).
 */

const SUPABASE_URL: string =
  (Constants.expoConfig?.extra?.supabaseUrl as string) ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://huolkgcnizwrhzyboemd.supabase.co';

const SUPABASE_KEY: string =
  (Constants.expoConfig?.extra?.supabaseKey as string) ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  '';

const AUTH_URL = `${SUPABASE_URL}/auth/v1`;

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  email: string | null;
  user_id: string | null;
}

function baseHeaders(): Record<string, string> {
  return { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
}

function toSession(data: any): Session {
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    email: data.user?.email ?? null,
    user_id: data.user?.id ?? null,
  };
}

/** Sign in with email/password. Throws on failure. */
export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error_description || (err as any).msg || 'Auth failed');
  }
  return toSession(await res.json());
}

/** Exchange a refresh token for a fresh session. Throws on failure. */
export async function refreshSession(refreshToken: string): Promise<Session> {
  const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error('Refresh failed');
  return toSession(await res.json());
}

/** Best-effort server-side sign-out (revokes the refresh token). */
export async function signOut(accessToken: string): Promise<void> {
  await fetch(`${AUTH_URL}/logout`, {
    method: 'POST',
    headers: { ...baseHeaders(), Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}
