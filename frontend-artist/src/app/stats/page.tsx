'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import { getPlatformStats, PlatformStats } from '@/lib/api';
import BottomNav from '@/components/layout/BottomNav';

const PLATFORM_COLORS: Record<string, string> = {
  spotify: '#1DB954',
  apple_music: '#FA243C',
  deezer: '#FEAA2D',
  youtube_music: '#FF0000',
  amazon_music: '#00A8E1',
  tidal: '#000000',
  bandcamp: '#629AA9',
  soundcloud: '#FF5500',
  other: '#6366f1',
};

export default function StatsPage() {
  const { artist, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<PlatformStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (artist) {
      loadStats();
    }
  }, [artist, year]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getPlatformStats(year);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('en-US', { style: 'currency', currency });
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toLocaleString('en-US');
  };

  const totalRevenue = stats.reduce((sum, s) => sum + parseFloat(s.gross), 0);
  const totalStreams = stats.reduce((sum, s) => sum + s.streams, 0);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-content2 transition-colors">
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="font-semibold text-foreground">Statistics</h1>
              <p className="text-xs text-secondary-500">By platform</p>
            </div>
          </div>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-1.5 bg-content2 border border-divider rounded-lg text-sm font-medium focus:outline-none focus:border-primary"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </header>

      <main className="px-4 py-4 pb-24 space-y-6">
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" color="primary" />
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background border border-divider rounded-2xl p-4">
                <p className="text-xs text-secondary-500 mb-1">Revenue {year}</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(totalRevenue.toString())}</p>
              </div>
              <div className="bg-background border border-divider rounded-2xl p-4">
                <p className="text-xs text-secondary-500 mb-1">Streams {year}</p>
                <p className="text-xl font-bold text-foreground">{formatNumber(totalStreams)}</p>
              </div>
            </div>

            {/* Platform breakdown */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-secondary-500 uppercase tracking-wide px-1">
                Breakdown
              </h2>

              {stats.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-secondary-500">No data for {year}</p>
                </div>
              ) : (
                stats.map((platform) => (
                  <div
                    key={platform.platform}
                    className="bg-background border border-divider rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${PLATFORM_COLORS[platform.platform] || PLATFORM_COLORS.other}20` }}
                        >
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: PLATFORM_COLORS[platform.platform] || PLATFORM_COLORS.other }}
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{platform.platform_label}</p>
                          <p className="text-xs text-secondary-500">{formatNumber(platform.streams)} streams</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">{formatCurrency(platform.gross)}</p>
                        <p className="text-xs text-secondary-500">{platform.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 bg-content2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${platform.percentage}%`,
                          backgroundColor: PLATFORM_COLORS[platform.platform] || PLATFORM_COLORS.other,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
