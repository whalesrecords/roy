'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AdminBottomNav } from '@/components/roy/AdminBottomNav';
import { Card, Eyebrow, Pill, Kpi, Avatar } from '@/components/roy/ui';
import { Sheet } from '@/components/roy/Sheet';

/**
 * Admin Tableau de bord — mobile-first redesign matching ROY Admin prototype.
 * Hero net-label · 2 KPIs · action banner · top artists list.
 *
 * Data is mocked here; the real data hooks (getAnalyticsSummary,
 * getArtistsSummary, etc.) will be wired in Phase 2.
 */

interface TopArtist {
  rank: number;
  initials: string;
  name: string;
  amount: string;
  accent?: boolean;
}

const TOP_ARTISTS: TopArtist[] = [
  { rank: 1, initials: 'AK', name: 'AYO KORE', amount: '48 240 €', accent: true },
  { rank: 2, initials: 'NB', name: 'NÉBULA', amount: '39 100 €' },
  { rank: 3, initials: 'Mw', name: 'Marlow', amount: '31 800 €' },
];

export default function DashboardPage() {
  const [openArtist, setOpenArtist] = useState<TopArtist | null>(null);

  return (
    <div className="min-h-screen pb-[124px]" style={{ background: 'var(--bg)' }}>
      <div className="px-5 pt-2 max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between py-2 mb-[18px]">
          <div>
            <div className="text-xs" style={{ color: 'var(--text-3)' }}>Whales Records</div>
            <h1 className="text-[22px] font-bold tracking-[-0.025em] mt-0.5" style={{ color: 'var(--text)' }}>
              Tableau de bord
            </h1>
          </div>
          <Avatar name="Label Manager" size={40} />
        </div>

        {/* Hero — Net label */}
        <div
          className="relative overflow-hidden rounded-[28px] border p-[24px_22px_20px]"
          style={{ background: 'var(--hero)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
        >
          <div
            className="absolute -top-[50px] -right-[40px] w-[170px] h-[170px] rounded-full opacity-55"
            style={{ background: 'var(--accent-soft)', filter: 'blur(10px)' }}
          />
          <Eyebrow>Net label · 2025</Eyebrow>
          <div
            className="roy-num text-[46px] font-bold mt-2 leading-none"
            style={{ color: 'var(--text)', letterSpacing: '-0.035em' }}
          >
            67 840
            <span className="text-[24px] font-semibold ml-1" style={{ color: 'var(--text-3)' }}>€</span>
          </div>
          <div className="relative flex gap-4 mt-[14px]">
            <div>
              <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>Revenus</div>
              <div className="roy-num text-sm font-semibold mt-0.5" style={{ color: 'var(--text)' }}>248 400 €</div>
            </div>
            <div className="w-px" style={{ background: 'var(--border)' }} />
            <div>
              <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>Dépenses</div>
              <div className="roy-num text-sm font-semibold mt-0.5" style={{ color: 'var(--text)' }}>96 200 €</div>
            </div>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-[11px] mt-[11px]">
          <Kpi label="Royalties dues" value="84 360 €" hint="12 artistes" />
          <Kpi label="Marge nette" value="27,3 %" accentValue />
        </div>

        {/* Action banner */}
        <Link
          href="/royalties"
          className="flex items-center gap-[13px] rounded-[18px] border p-[15px_16px] mt-[11px] transition-colors hover:bg-surface-2"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
        >
          <div
            className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-none"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 3v18M7 7h7a3 3 0 010 6H7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Calcul Q4 à valider</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>84 360 € · 12 artistes</div>
          </div>
          <Pill tone="accent">Réviser</Pill>
        </Link>

        {/* Top artists */}
        <div className="flex items-center justify-between mt-6 mb-[12px] px-0.5">
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Top artistes</span>
          <Link href="/artists" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
            Tout voir
          </Link>
        </div>
        <div
          className="rounded-[20px] border px-4 py-1.5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
        >
          {TOP_ARTISTS.map((a, i) => (
            <button
              key={a.rank}
              onClick={() => setOpenArtist(a)}
              className={`w-full flex items-center gap-3 py-[13px] text-left ${i < TOP_ARTISTS.length - 1 ? 'border-b' : ''}`}
              style={i < TOP_ARTISTS.length - 1 ? { borderColor: 'var(--border)' } : undefined}
            >
              <span className="roy-num text-[11px] w-3" style={{ color: 'var(--text-3)' }}>{a.rank}</span>
              <div
                className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[11px] font-bold flex-none"
                style={{
                  background: a.accent ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: a.accent ? 'var(--accent)' : 'var(--text-2)',
                }}
              >
                {a.initials}
              </div>
              <span className="flex-1 text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>{a.name}</span>
              <span className="roy-num text-[13px] font-bold" style={{ color: 'var(--text)' }}>{a.amount}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Artist detail sheet — phase 2 will wire real data */}
      <Sheet open={!!openArtist} onClose={() => setOpenArtist(null)}>
        {openArtist && (
          <>
            <div className="flex items-center gap-[15px]">
              <div
                className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-[20px] font-bold flex-none"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                {openArtist.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>{openArtist.name}</div>
                <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  Signé · Royalties dues : {openArtist.amount}
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpenArtist(null)}
              className="w-full mt-4 py-[14px] rounded-[14px] border text-[13.5px] font-semibold"
              style={{
                borderColor: 'var(--border-strong)',
                background: 'var(--surface)',
                color: 'var(--text)',
              }}
            >
              Fermer
            </button>
          </>
        )}
      </Sheet>

      <AdminBottomNav />
    </div>
  );
}
