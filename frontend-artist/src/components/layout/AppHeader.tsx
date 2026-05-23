'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
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

// Page titles for sub-pages
const TITLE_MAP: Record<string, string> = {
  '/expenses': 'Dépenses',
  '/contracts': 'Contrats',
  '/payments': 'Paiements',
  '/settings': 'Profil',
  '/releases': 'Sorties',
  '/tracks': 'Titres',
  '/stats': 'Statistiques',
  '/media': 'Médias',
  '/notifications': 'Notifications',
};

export default function AppHeader() {
  const pathname = usePathname();
  const { artist } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
  const pageTitle = subPageRoot ? TITLE_MAP[subPageRoot] : '';

  // Logo: prefer dark variant when in dark mode
  const logoSrc = theme === 'dark' && labelSettings?.logo_dark_base64
    ? labelSettings.logo_dark_base64
    : (labelSettings?.logo_base64 || labelSettings?.logo_url);

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-divider">
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
                className="w-8 h-8 rounded-full object-cover border border-divider shrink-0"
              />
            ) : (
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <span className="text-primary text-xs font-bold">{artist.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground text-sm leading-tight">{artist.name}</p>
              {labelSettings?.label_name && (
                <p className="text-[10px] text-default-400 leading-tight">{labelSettings.label_name}</p>
              )}
            </div>
          </div>
        ) : (
          /* ── Sub-page: back + title ── */
          <div className="flex items-center gap-2">
            <Link
              href={backHref}
              className="p-2 -ml-2 rounded-xl hover:bg-content1 transition-colors"
            >
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-2">
              {artist.artwork_url && (
                <img
                  src={artist.artwork_url}
                  alt={artist.name}
                  className="w-7 h-7 rounded-full object-cover border border-divider shrink-0"
                />
              )}
              <p className="font-semibold text-foreground text-sm">{pageTitle}</p>
            </div>
          </div>
        )}

        {/* ── Right: notifications + theme + settings (main) ── */}
        <div className="flex items-center gap-0.5">
          <NotificationBell />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-content1 transition-colors"
            aria-label="Changer de thème"
          >
            {theme === 'light'
              ? <svg className="w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              : <svg className="w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            }
          </button>
          {isMainPage && (
            <Link href="/settings" className="p-2 rounded-xl hover:bg-content1 transition-colors">
              <svg className="w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
