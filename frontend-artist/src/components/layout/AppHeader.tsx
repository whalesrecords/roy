'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLabelSettings, LabelSettings } from '@/lib/api';
import NotificationBell from './NotificationBell';

// Pages accessible from the BottomNav — show full branding header
const MAIN_PAGES = ['/', '/musique', '/statements', '/promo', '/support'];

// Back destinations for sub-pages
const BACK_MAP: Record<string, string> = {
  '/expenses': '/statements',
  '/contracts': '/statements',
  '/payments': '/statements',
  '/settings': '/',
  '/releases': '/musique',
  '/tracks': '/musique',
  '/stats': '/musique',
  '/media': '/',
  '/notifications': '/',
};

// Page titles for sub-pages — i18n keys (empty = use literal fallback)
const TITLE_KEY: Record<string, string> = {
  '/expenses': 'expenses.title',
  '/contracts': 'contracts.title',
  '/payments': 'payments.title',
  '/settings': 'settings.title',
  '/releases': 'releases.title',
  '/tracks': 'tracks.title',
  '/stats': 'stats.title',
  '/media': 'media.title',
  '/notifications': '',
};

export default function AppHeader() {
  const pathname = usePathname();
  const { artist } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const [labelSettings, setLabelSettings] = useState<LabelSettings | null>(null);

  useEffect(() => {
    getLabelSettings().then(setLabelSettings).catch(() => {});
  }, []);

  if (!artist) return null;

  // Determine if this is a main nav page or a sub-page
  const isMainPage = MAIN_PAGES.some(p =>
    pathname === p || (p !== '/' && pathname.startsWith(p))
  );

  // For sub-pages: resolve back href and title from the static maps
  const subPageRoot = Object.keys(BACK_MAP).find(prefix => pathname.startsWith(prefix));
  const backHref = subPageRoot ? BACK_MAP[subPageRoot] : '/';
  const pageTitle = subPageRoot ? (TITLE_KEY[subPageRoot] ? t(TITLE_KEY[subPageRoot]) : 'Notifications') : '';

  // Logo: prefer dark variant when in dark mode
  const logoSrc = theme === 'dark' && labelSettings?.logo_dark_base64
    ? labelSettings.logo_dark_base64
    : (labelSettings?.logo_base64 || labelSettings?.logo_url);

  return (
    <header className="lg:hidden sticky top-0 z-50 bg-app/80 backdrop-blur-xl border-b border-line safe-top">
      <div className="px-4 py-3 flex items-center justify-between max-w-lg mx-auto">
        {isMainPage ? (
          /* ── Main page: branding left ── */
          <div className="flex items-center gap-2.5">
            {logoSrc && (
              <img
                src={logoSrc}
                alt={labelSettings?.label_name || 'Label'}
                className="h-6 w-auto max-w-[72px] object-contain opacity-90"
              />
            )}
            {artist.artwork_url ? (
              <img
                src={artist.artwork_url}
                alt={artist.name}
                className="w-8 h-8 rounded-full object-cover border border-line shrink-0"
              />
            ) : (
              <div className="w-8 h-8 bg-accent-soft rounded-full flex items-center justify-center shrink-0">
                <span className="text-accent text-xs font-bold">{artist.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <p className="font-semibold text-ink text-sm leading-tight">{artist.name}</p>
              {labelSettings?.label_name && (
                <p className="text-[10px] text-ink-faint leading-tight">{labelSettings.label_name}</p>
              )}
            </div>
          </div>
        ) : (
          /* ── Sub-page: back + title ── */
          <div className="flex items-center gap-2">
            <Link
              href={backHref}
              className="flex items-center justify-center w-[34px] h-[34px] rounded-[11px] border border-line bg-surface text-ink hover:bg-surface-2 transition-colors min-h-[44px] min-w-[44px]"
              aria-label="Retour"
            >
              <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <p className="font-bold text-ink text-[17px] tracking-[-0.02em]">{pageTitle}</p>
          </div>
        )}

        {/* ── Right: notifications + theme + settings (main) ── */}
        <div className="flex items-center gap-0.5">
          <NotificationBell />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-surface-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Changer de thème"
          >
            {theme === 'light'
              ? <svg className="w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              : <svg className="w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            }
          </button>
          {isMainPage && (
            <Link href="/settings" className="p-2 rounded-xl hover:bg-surface-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label={t('settings.title')}>
              <svg className="w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
