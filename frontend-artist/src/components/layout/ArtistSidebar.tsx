'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, ACCENTS } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLabelSettings, LabelSettings } from '@/lib/api';
import {
  IconHome, IconChart, IconMusic, IconFile, IconCard,
  IconMegaphone, IconSupport, IconSettings,
} from '@/components/roy/icons';

const NAV = [
  { href: '/', key: 'nav.home', Icon: IconHome },
  { href: '/stats', key: 'stats.title', Icon: IconChart },
  { href: '/musique', key: 'nav.music', Icon: IconMusic },
  { href: '/statements', key: 'statements.title', Icon: IconFile },
  { href: '/payments', key: 'payments.title', Icon: IconCard },
  { href: '/promo', key: 'nav.promo', Icon: IconMegaphone },
  { href: '/support', key: 'support.title', Icon: IconSupport },
] as const;

export default function ArtistSidebar() {
  const pathname = usePathname();
  const { artist } = useAuth();
  const { theme, toggleTheme, accent, setAccent } = useTheme();
  const { t } = useLanguage();
  const [label, setLabel] = useState<LabelSettings | null>(null);

  useEffect(() => {
    getLabelSettings().then(setLabel).catch(() => {});
  }, []);

  if (!artist) return null;

  const initials = artist.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[236px] flex-col border-r border-line bg-surface px-4 py-5 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 mb-6">
        <span className="w-[9px] h-[9px] rounded-[3px] bg-accent" />
        <span className="text-[18px] font-bold tracking-[-0.02em] text-ink">ROY</span>
      </div>

      {/* Profile */}
      <div className="flex items-center gap-3 p-[11px] mb-5 rounded-[13px] bg-surface-2 border border-line">
        {artist.artwork_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artist.artwork_url} alt={artist.name} className="w-[38px] h-[38px] rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-[38px] h-[38px] rounded-full bg-accent-soft text-accent flex items-center justify-center text-[13px] font-bold shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-ink truncate">{artist.name}</div>
          <div className="text-[11px] text-ink-faint truncate">Artiste · {label?.label_name || 'Whales Rec.'}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-[3px]">
        {NAV.map(({ href, key, Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-[11px] px-[11px] py-2.5 rounded-[11px] text-[13.5px] transition-colors ${
                active ? 'bg-accent-soft text-accent font-semibold' : 'text-ink-muted hover:text-ink font-medium'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 1.9 : 1.8} />
              {t(key)}
            </Link>
          );
        })}
      </nav>

      {/* Bottom — accent picker + theme + settings */}
      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-center gap-2 px-[11px]">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAccent(a.id)}
              aria-label={a.label}
              className={`w-4 h-4 rounded-full transition-transform ${accent === a.id ? 'ring-2 ring-offset-2 ring-offset-surface scale-110' : ''}`}
              style={{ backgroundColor: a.color, boxShadow: accent === a.id ? `0 0 0 2px var(--surface), 0 0 0 3.5px ${a.color}` : undefined }}
            />
          ))}
        </div>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-[11px] px-[11px] py-2.5 rounded-[11px] text-[13.5px] font-medium text-ink-faint hover:text-ink transition-colors"
        >
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
          {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
        </button>
        <Link
          href="/settings"
          className={`flex items-center gap-[11px] px-[11px] py-2.5 rounded-[11px] text-[13.5px] font-medium transition-colors ${
            pathname.startsWith('/settings') ? 'bg-accent-soft text-accent' : 'text-ink-faint hover:text-ink'
          }`}
        >
          <IconSettings size={18} />
          {t('settings.title')}
        </Link>
      </div>
    </aside>
  );
}
