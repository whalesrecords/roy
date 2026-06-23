'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Spinner } from '@heroui/react';
import { getArtistDashboard, getProfile, ArtistDashboard, ArtistProfile } from '@/lib/api';
import { ArtistBottomNav } from '@/components/roy/ArtistBottomNav';

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

interface SettingRow {
  icon: React.ReactNode;
  label: string;
  value?: string;
  href?: string;
}

export default function MobileProfilPage() {
  const [dashboard, setDashboard] = useState<ArtistDashboard | null>(null);
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [d, p] = await Promise.all([getArtistDashboard(), getProfile()]);
        setDashboard(d);
        setProfile(p);
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

  const artistName = dashboard?.artist.name || 'Artiste';

  const maskedIban = profile?.iban
    ? profile.iban.slice(0, 4) + ' •••• ' + profile.iban.slice(-4)
    : null;

  const settings: SettingRow[] = [
    {
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="2" y="5" width="20" height="14" rx="3" />
          <path d="M2 10h20" strokeLinecap="round" />
        </svg>
      ),
      label: 'Compte SEPA',
      value: maskedIban || 'Non renseigné',
      href: '/settings',
    },
    {
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M9 12l2 2 4-4M7.5 4h9l4 4v12a1 1 0 01-1 1H4.5a1 1 0 01-1-1V8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      label: 'Mon contrat',
      value: 'Voir les détails',
      href: '/contracts',
    },
    {
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      label: 'Aide & contact label',
      href: '/support',
    },
  ];

  return (
    <div className="min-h-screen pb-[124px]" style={{ background: 'var(--bg)' }}>
      <div className="px-5 pt-2 max-w-md mx-auto">
        {error && (
          <div className="mb-3 px-4 py-3 rounded-[12px] border border-line text-sm text-neg" style={{ background: 'var(--surface)' }}>
            {error}
          </div>
        )}

        {/* Avatar + identity */}
        <div className="flex flex-col items-center py-6 mb-1">
          {dashboard?.artist.artwork_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dashboard.artist.artwork_url} alt={artistName} className="w-[84px] h-[84px] rounded-full object-cover border" style={{ borderColor: 'var(--border)' }} />
          ) : (
            <div
              className="w-[84px] h-[84px] rounded-full border flex items-center justify-center text-[28px] font-bold"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--border)' }}
            >
              {initials(artistName)}
            </div>
          )}
          <div className="text-[19px] font-bold tracking-[-0.02em] mt-3.5" style={{ color: 'var(--text)' }}>{artistName}</div>
          <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Artiste · Whales Records</div>
        </div>

        {/* Settings list */}
        <div
          className="rounded-[18px] border px-4 py-1.5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
        >
          {settings.map((s, i) => (
            <Link
              key={s.label}
              href={s.href || '#'}
              className={`flex items-center gap-3 py-[14px] ${i < settings.length - 1 ? 'border-b' : ''}`}
              style={i < settings.length - 1 ? { borderColor: 'var(--border)' } : undefined}
            >
              <div
                className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-none"
                style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
              >
                {s.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>{s.label}</div>
                {s.value && (
                  <div
                    className={`text-[11px] mt-0.5 ${s.label === 'Compte SEPA' ? 'font-mono' : ''} truncate`}
                    style={{ color: 'var(--text-3)' }}
                  >
                    {s.value}
                  </div>
                )}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-3)' }} className="flex-none">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}
        </div>

        {/* Logout */}
        <Link
          href="/logout"
          className="block w-full mt-3.5 py-[14px] rounded-[14px] border text-[13px] font-semibold text-center"
          style={{
            borderColor: 'var(--border-strong)',
            background: 'var(--surface)',
            color: 'var(--text-2)',
          }}
        >
          Se déconnecter
        </Link>
      </div>

      <ArtistBottomNav />
    </div>
  );
}
