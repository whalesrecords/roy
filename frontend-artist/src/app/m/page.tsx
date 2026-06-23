'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Spinner } from '@heroui/react';
import { getArtistDashboard, getArtistPayments, ArtistDashboard, ArtistPayment } from '@/lib/api';
import { ArtistBottomNav } from '@/components/roy/ArtistBottomNav';
import { Eyebrow } from '@/components/roy/ui';

const fmtEUR = (s: string | number) => {
  const n = typeof s === 'string' ? parseFloat(s) : s;
  return (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
};

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const fmtDayMonth = (s: string) =>
  new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export default function MobileHomePage() {
  const [data, setData] = useState<ArtistDashboard | null>(null);
  const [payments, setPayments] = useState<ArtistPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [d, p] = await Promise.all([getArtistDashboard(), getArtistPayments()]);
        setData(d);
        setPayments(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const available = data ? parseFloat(data.advance_balance) : 0;
  const totalNet = data ? parseFloat(data.total_net) : 0;
  const artistName = data?.artist.name || 'Artiste';
  const firstName = artistName.split(' ')[0];
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Activity feed: take last 5 payments
  const recent = payments.slice(0, 5);

  return (
    <div className="min-h-screen pb-[124px]" style={{ background: 'var(--bg)' }}>
      <div className="px-5 pt-2 max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between py-2 mb-[18px]">
          <div>
            <div className="text-xs capitalize" style={{ color: 'var(--text-3)' }}>{today}</div>
            <h1 className="text-[22px] font-bold tracking-[-0.025em] mt-0.5" style={{ color: 'var(--text)' }}>
              Bonjour, {firstName}
            </h1>
          </div>
          {data?.artist.artwork_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.artist.artwork_url} alt={artistName} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {initials(artistName)}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-3 px-4 py-3 rounded-[12px] border border-line text-sm text-neg" style={{ background: 'var(--surface)' }}>
            {error}
          </div>
        )}

        {/* Hero — Disponible au versement */}
        <div
          className="relative overflow-hidden rounded-[28px] border p-[24px_22px_20px]"
          style={{ background: 'var(--hero)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
        >
          <div
            className="absolute -top-[50px] -right-[40px] w-[170px] h-[170px] rounded-full opacity-55"
            style={{ background: 'var(--accent-soft)', filter: 'blur(10px)' }}
          />
          <Eyebrow>Disponible au versement</Eyebrow>
          <div
            className="roy-num text-[50px] font-bold mt-2 leading-none"
            style={{ color: 'var(--text)', letterSpacing: '-0.035em' }}
          >
            {fmtEUR(available)}
          </div>
          <div className="relative flex items-center gap-2 mt-3">
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: 'var(--accent)' }} />
            <span className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>
              <span className="font-semibold" style={{ color: 'var(--text)' }}>Solde recoupable</span>
            </span>
          </div>
          <Link
            href="/m/releves"
            className="mt-5 flex items-center justify-center gap-2 py-[14px] rounded-[15px] font-bold text-[13.5px]"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            Voir mes relevés
          </Link>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-[11px] mt-[11px]">
          <div
            className="rounded-[18px] border p-4"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <Eyebrow>Cumul net</Eyebrow>
            <div className="roy-num text-[22px] font-bold mt-1.5" style={{ color: 'var(--text)' }}>{fmtEUR(totalNet)}</div>
          </div>
          <div
            className="rounded-[18px] border p-4"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <Eyebrow>Streams</Eyebrow>
            <div className="roy-num text-[22px] font-bold mt-1.5" style={{ color: 'var(--text)' }}>
              {(data?.total_streams || 0) >= 1000
                ? ((data?.total_streams || 0) / 1_000_000).toFixed(2).replace('.', ',') + ' M'
                : data?.total_streams || 0}
            </div>
          </div>
        </div>

        {/* Activité récente */}
        {recent.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-6 mb-[12px] px-0.5">
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Activité récente</span>
              <Link href="/m/releves" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Tout voir</Link>
            </div>
            <div
              className="rounded-[20px] border px-4 py-1.5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
            >
              {recent.map((p, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 py-[13px] ${i < recent.length - 1 ? 'border-b' : ''}`}
                  style={i < recent.length - 1 ? { borderColor: 'var(--border)' } : undefined}
                >
                  <div
                    className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center flex-none"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 19V5M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>
                      {p.description || 'Versement'}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {fmtDayMonth(p.date)}
                    </div>
                  </div>
                  <span className="roy-num text-[13.5px] font-bold" style={{ color: 'var(--accent)' }}>
                    +{fmtEUR(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ArtistBottomNav />
    </div>
  );
}
