import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// ---------------------------------------------------------------------------
// Persistent in-memory result store (survives screen unmount/remount).
// Keyed by a caller-provided string. Lets a screen render instantly from
// memory and refresh silently in the background — no loader flash, no
// "reload every time you reopen a page".
// ---------------------------------------------------------------------------
const _store = new Map<string, unknown>();

export function clearFetchCache(prefix?: string) {
  if (!prefix) { _store.clear(); return; }
  for (const k of Array.from(_store.keys())) {
    if (k.startsWith(prefix)) _store.delete(k);
  }
}

export function hasFetchCache(key: string): boolean {
  return _store.has(key);
}

/**
 * Refetch when the screen regains focus, but ONLY if the cache for `key` was
 * cleared (e.g. by a mutation elsewhere). Normal back-navigation, where the
 * cache is still warm, does NOT trigger a reload — so pages don't reload every
 * time you reopen them. Skips the very first focus (the mount fetch handles it).
 */
export function useRefreshOnFocus(key: string | undefined, reload: () => void) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) { first.current = false; return; }
      if (key != null && !_store.has(key)) reload();
    }, [key, reload]),
  );
}

/**
 * Data hook with stale-while-revalidate.
 *
 * - First visit (no cached value for `key`): shows a loader, then the data.
 * - Subsequent visits: shows the cached data immediately, refreshes silently.
 * - `reload()` always re-fetches (used by pull-to-refresh).
 *
 * Pass a stable `key` to enable the persistent cache; omit it for one-off fetches.
 */
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[] = [], key?: string): FetchState<T> {
  const seeded = key != null && _store.has(key) ? (_store.get(key) as T) : null;
  const [data, setData] = useState<T | null>(seeded);
  const [loading, setLoading] = useState<boolean>(seeded == null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const hasCache = key != null && _store.has(key);
    if (!hasCache) setLoading(true); // keep showing cached data while revalidating
    setError(null);
    fn()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        if (key != null) _store.set(key, d);
      })
      .catch((e) => {
        // Keep stale data on a transient error instead of blanking the screen.
        if (!cancelled && !hasCache) setError(e?.message || 'Erreur');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload };
}
