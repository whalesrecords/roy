'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@heroui/react';
import { getArtistDashboard, getPlatformStats, getAvailableYears, ArtistDashboard, PlatformStats } from '@/lib/api';
import { ArtistBottomNav } from '@/components/roy/ArtistBottomNav';
import { Eyebrow, platformColor } from '@/components/roy/ui';

const fmtEUR = (s: string | number) => {
  const n = typeof s === 'string' ? parseFloat(s) : s;
  return (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
};

const fmtMillions = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace('.', ',') + ' M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.', ',') + ' K';
  return n.toString();
};

export default function MobileStatsPage() {
  const [data, setData] = useState<ArtistDashboard | null>(null);
  const [platforms, setPlatforms] = useState<PlatformStats[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const yr = await getAvailableYears();
        setYears(yr.years);
        setYear(yr.default_year ?? yr.years[0] ?? new Date().getFullYear());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!year) return;
    (async () => {
      setLoading(true);
      try {
        const [d, p] = await Promise.all([getArtistDashboard(), getPlatformStats(year)]);
        setData(d);
        setPlatforms(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, [year]);

  if (loading || !year) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const totalGross = data ? parseFloat(data.total_gross) : 0;
  const totalStreams = data?.total_streams || 0;
  const maxPlatformGross = Math.max(0, ...platforms.map(p => parseFloat(p.gross)));

  return (
    <div className="min-h-screen pb-[124px]" style={{ background: 'var(--bg)' }}>
      <div className="px-5 pt-2 max-w-md mx-auto">
        <div className="py-2 mb-4">
          <h1 className="text-[22px] font-bold tracking-[-0.025em]" style={{ color: 'var(--text)' }}>Statistiques</h1>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Performance {year}</div>
        </div>

        {/* Year pills */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar">
          {years.slice(0, 5).map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className="px-4 py-[7px] rounded-full text-[12.5px] font-semibold whitespace-nowrap border transition-colors"
              style={
                y === year
                  ? { background: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)' }
                  : { background: 'var(--surface)', color: 'var(--text-2)', borderColor: 'var(--border)' }
              }
            >
              {y}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-3 px-4 py-3 rounded-[12px] border border-line text-sm text-neg" style={{ background: 'var(--surface)' }}>
            {error}
          </div>
        )}

        {/* Hero — Revenus bruts */}
        <div
          className="relative overflow-hidden rounded-[24px] border p-[22px_20px_16px]"
          style={{ background: 'var(--hero)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
        >
          <Eyebrow>Revenus bruts · {year}</Eyebrow>
          <div
            className="roy-num text-[44px] font-bold mt-2.5 leading-none"
            style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}
          >
            {fmtEUR(totalGross)}
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-[11px] mt-[11px]">
          <div
            className="rounded-[18px] border p-[15px]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <Eyebrow>Streams</Eyebrow>
            <div className="roy-num text-[22px] font-bold mt-1.5" style={{ color: 'var(--text)' }}>{fmtMillions(totalStreams)}</div>
          </div>
          <div
            className="rounded-[18px] border p-[15px]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <Eyebrow>Plateformes</Eyebrow>
            <div className="roy-num text-[22px] font-bold mt-1.5" style={{ color: 'var(--text)' }}>{platforms.length}</div>
          </div>
        </div>

        {/* Par plateforme */}
        {platforms.length > 0 && (
          <div
            className="rounded-[20px] border p-[18px] mt-[11px]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Par plateforme</span>
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{platforms.length} source{platforms.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex flex-col gap-[14px]">
              {platforms.slice(0, 6).map(p => {
                const amount = parseFloat(p.gross);
                const pct = maxPlatformGross > 0 ? (amount / maxPlatformGross) * 100 : 0;
                const color = platformColor(p.platform) || 'var(--accent)';
                return (
                  <div key={p.platform}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-2 text-[12.5px] font-medium" style={{ color: 'var(--text)' }}>
                        <span className="w-2 h-2 rounded-[3px]" style={{ background: color }} />
                        {p.platform_label}
                      </span>
                      <span className="roy-num text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                        {fmtEUR(amount)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--track)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ArtistBottomNav />
    </div>
  );
}
