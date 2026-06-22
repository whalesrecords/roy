'use client';

import Link from 'next/link';
import { Card, AccentButton } from '@/components/roy/ui';
import {
  IconImport, IconContract, IconChart, IconMegaphone, IconCheck, IconChevronRight,
} from '@/components/roy/icons';

const CARDS = [
  {
    href: '/promo/import',
    title: 'Import CSV',
    desc: 'Importez vos campagnes depuis SubmitHub ou Groover',
    icon: IconImport,
  },
  {
    href: '/promo/submissions',
    title: 'Submissions',
    desc: 'Consultez toutes les submissions promo',
    icon: IconContract,
  },
  {
    href: '/promo/stats',
    title: 'Statistiques',
    desc: 'Visualisez les stats globales',
    icon: IconChart,
  },
];

const FEATURES = [
  'Import CSV SubmitHub et Groover',
  'Matching automatique avec le catalogue',
  'Tracking budget dans advance ledger',
  'Stats par source (SubmitHub vs Groover)',
  'Visible par les artistes dans leur portail',
];

export default function PromoPage() {
  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div>
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Promo Management</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">Gérez vos campagnes promo SubmitHub et Groover</p>
        </div>
        <Link href="/promo/import">
          <AccentButton>
            <IconImport size={14} /> Import CSV
          </AccentButton>
        </Link>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {/* Navigation cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {CARDS.map(({ href, title, desc, icon: Icon }) => (
            <Link key={href} href={href} className="group">
              <Card className="h-full transition-colors hover:border-line-strong">
                <div className="w-11 h-11 rounded-[12px] bg-accent-soft text-accent flex items-center justify-center mb-4 transition-colors group-hover:bg-accent group-hover:text-accent-ink">
                  <Icon size={20} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[15px] font-bold text-ink">{title}</h2>
                  <IconChevronRight size={16} className="text-ink-faint transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[12.5px] text-ink-faint mt-1.5 leading-relaxed">{desc}</p>
              </Card>
            </Link>
          ))}
        </div>

        {/* Features */}
        <Card hero>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <IconMegaphone size={16} />
            </div>
            <h3 className="text-[14px] font-bold text-ink">Fonctionnalités</h3>
          </div>
          <ul className="space-y-2.5">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2.5 text-[13px] text-ink-muted">
                <span className="w-5 h-5 rounded-full bg-accent-soft text-accent flex items-center justify-center shrink-0">
                  <IconCheck size={12} />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
