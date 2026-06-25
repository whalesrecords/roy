import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { setAuthToken, setTokenProvider, getLabelSettings, invalidateCache } from '@/lib/api';
import { clearFetchCache } from '@/lib/useFetch';
import { Session, signInWithPassword, refreshSession, signOut } from '@/lib/supabase';

interface AdminUser { email: string | null }

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'admin-session';
const SKEW = 60; // refresh when fewer than 60s remain

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);

  // Keep a single in-flight refresh so concurrent requests share it.
  const refreshing = useRef<Promise<string | null> | null>(null);

  const persist = async (s: Session | null) => {
    sessionRef.current = s;
    setAuthToken(s?.access_token ?? null);
    if (s) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s)).catch(() => {});
    else await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
  };

  // Returns a valid access token, refreshing if it is about to expire.
  const provideToken = async (): Promise<string | null> => {
    const s = sessionRef.current;
    if (!s) return null;
    const now = Math.floor(Date.now() / 1000);
    if (s.expires_at - now > SKEW) return s.access_token;
    if (!refreshing.current) {
      refreshing.current = (async () => {
        try {
          const fresh = await refreshSession(s.refresh_token);
          await persist(fresh);
          return fresh.access_token;
        } catch {
          await persist(null);
          setUser(null);
          return null;
        } finally {
          refreshing.current = null;
        }
      })();
    }
    return refreshing.current;
  };

  useEffect(() => {
    setTokenProvider(provideToken);
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        if (raw) {
          const s = JSON.parse(raw) as Session;
          sessionRef.current = s;
          setAuthToken(s.access_token);
          // Validate the session still grants admin access.
          await getLabelSettings();
          setUser({ email: s.email });
        }
      } catch {
        await persist(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => setTokenProvider(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const s = await signInWithPassword(email.trim(), password);
      await persist(s);
      // Confirm this Supabase user is an allowlisted admin (backend enforces it).
      invalidateCache();
      await getLabelSettings();
      setUser({ email: s.email });
      return true;
    } catch {
      await persist(null);
      setUser(null);
      return false;
    }
  };

  const logout = async () => {
    const s = sessionRef.current;
    if (s?.access_token) await signOut(s.access_token);
    await persist(null);
    invalidateCache();
    clearFetchCache();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
