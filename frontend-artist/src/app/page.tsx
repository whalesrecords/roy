'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getArtistDashboard, ArtistDashboard } from '@/lib/api';

export default function DashboardPage() {
  const { artist, loading: authLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [data, setData] = useState<ArtistDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (artist) {
      loadDashboard();
    }
  }, [artist]);

  const loadDashboard = async () => {
    try {
      const dashboard = await getArtistDashboard();
      setData(dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('fr-FR', { style: 'currency', currency });
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toLocaleString('fr-FR');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!artist) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data?.artist.artwork_url ? (
              <img
                src={data.artist.artwork_url}
                alt={artist.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">
                  {artist.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground">{artist.name}</p>
              <p className="text-xs text-secondary-500">Espace Artiste</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-content2 hover:bg-content3 transition-colors"
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-full bg-content2 hover:bg-danger/10 hover:text-danger transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 pb-24 space-y-6">
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Main Balance Card */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-6 text-white shadow-xl shadow-primary/30">
          <p className="text-white/70 text-sm font-medium mb-1">Solde disponible</p>
          <p className="text-4xl font-bold mb-4">
            {data ? formatCurrency(data.total_net, data.currency) : '—'}
          </p>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <p className="text-white/70">Revenus bruts</p>
              <p className="font-semibold">{data ? formatCurrency(data.total_gross, data.currency) : '—'}</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-white/70">Avances</p>
              <p className="font-semibold">{data ? formatCurrency(data.advance_balance, data.currency) : '—'}</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-background border border-divider rounded-2xl p-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatNumber(data?.total_streams || 0)}</p>
            <p className="text-sm text-secondary-500">Streams totaux</p>
          </div>

          <div className="bg-background border border-divider rounded-2xl p-4">
            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-foreground">{data?.release_count || 0}</p>
            <p className="text-sm text-secondary-500">Releases</p>
          </div>

          <div className="bg-background border border-divider rounded-2xl p-4">
            <div className="w-10 h-10 bg-warning/10 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-foreground">{data?.track_count || 0}</p>
            <p className="text-sm text-secondary-500">Tracks</p>
          </div>

          <Link href="/stats" className="bg-background border border-divider rounded-2xl p-4 hover:border-primary/50 transition-colors">
            <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-foreground">Voir les stats</p>
            <p className="text-xs text-secondary-500">Par plateforme</p>
          </Link>
        </div>

        {/* Quick Links */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-secondary-500 uppercase tracking-wide px-1">
            Détails
          </h2>

          <Link
            href="/releases"
            className="flex items-center gap-4 p-4 bg-background border border-divider rounded-2xl hover:border-primary/50 transition-colors"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Mes Releases</p>
              <p className="text-sm text-secondary-500">Revenus par album</p>
            </div>
            <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/tracks"
            className="flex items-center gap-4 p-4 bg-background border border-divider rounded-2xl hover:border-primary/50 transition-colors"
          >
            <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Mes Tracks</p>
              <p className="text-sm text-secondary-500">Revenus par titre</p>
            </div>
            <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/payments"
            className="flex items-center gap-4 p-4 bg-background border border-divider rounded-2xl hover:border-primary/50 transition-colors"
          >
            <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Paiements</p>
              <p className="text-sm text-secondary-500">Historique des versements</p>
            </div>
            <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-divider safe-bottom">
        <div className="flex items-center justify-around py-2">
          <Link href="/" className="flex flex-col items-center gap-1 px-4 py-2 text-primary">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs font-medium">Accueil</span>
          </Link>
          <Link href="/releases" className="flex flex-col items-center gap-1 px-4 py-2 text-secondary-500 hover:text-primary transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-xs font-medium">Releases</span>
          </Link>
          <Link href="/stats" className="flex flex-col items-center gap-1 px-4 py-2 text-secondary-500 hover:text-primary transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-xs font-medium">Stats</span>
          </Link>
          <Link href="/payments" className="flex flex-col items-center gap-1 px-4 py-2 text-secondary-500 hover:text-primary transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-xs font-medium">Paiements</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
