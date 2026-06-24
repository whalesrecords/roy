import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  Artist, getMe, loginWithCode as apiLoginCode, loginWithEmail as apiLoginEmail, setAuthToken,
} from '@/lib/api';

interface AuthContextType {
  artist: Artist | null;
  loading: boolean;
  loginWithCode: (code: string) => Promise<boolean>;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'artist-token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          const me = await getMe();
          setArtist(me);
        }
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
        setAuthToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = async (token: string, a: Artist) => {
    setAuthToken(token);
    await SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {});
    setArtist(a);
  };

  const loginWithCode = async (code: string) => {
    try {
      const res = await apiLoginCode(code);
      await persist(res.token, res.artist);
      return true;
    } catch {
      return false;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      const res = await apiLoginEmail(email, password);
      await persist(res.token, res.artist);
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    setAuthToken(null);
    setArtist(null);
  };

  return (
    <AuthContext.Provider value={{ artist, loading, loginWithCode, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
