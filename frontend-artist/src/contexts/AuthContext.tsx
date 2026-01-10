'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface Artist {
  id: string;
  name: string;
  email?: string;
  artwork_url?: string;
}

interface AuthContextType {
  artist: Artist | null;
  loading: boolean;
  login: (code: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!loading && !artist && pathname !== '/login') {
      router.push('/login');
    }
  }, [loading, artist, pathname, router]);

  const checkAuth = async () => {
    const token = localStorage.getItem('artist-token');
    const artistId = localStorage.getItem('artist-id');

    if (!token || !artistId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/artist-portal/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setArtist(data);
      } else {
        localStorage.removeItem('artist-token');
        localStorage.removeItem('artist-id');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (code: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/artist-portal/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('artist-token', data.token);
        localStorage.setItem('artist-id', data.artist.id);
        setArtist(data.artist);
        router.push('/');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('artist-token');
    localStorage.removeItem('artist-id');
    setArtist(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ artist, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
