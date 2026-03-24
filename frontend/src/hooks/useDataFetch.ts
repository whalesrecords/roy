'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseDataFetchResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T>>;
  clearError: () => void;
}

/**
 * Generic hook for fetching data with loading/error states.
 *
 * @param fetcher - Async function that returns the data
 * @param initialData - Initial value before fetch completes
 * @param deps - Optional dependency array to re-fetch when values change
 *
 * @example
 * const { data: artists, loading, error, refetch } = useDataFetch(getArtists, []);
 *
 * @example
 * // Multiple fetches in parallel
 * const { data, loading, refetch } = useDataFetch(
 *   () => Promise.all([getArtists(), getImports()]),
 *   [[], []]
 * );
 * const [artists, imports] = data;
 */
export function useDataFetch<T>(
  fetcher: () => Promise<T>,
  initialData: T,
  deps: unknown[] = [],
): UseDataFetchResult<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const clearError = useCallback(() => setError(null), []);

  return { data, loading, error, refetch, setData, clearError };
}
