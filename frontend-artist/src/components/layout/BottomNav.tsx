'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getMyTickets } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const NAV_ICONS = {
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  music: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z',
  revenue: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  support: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
};

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [unreadTickets, setUnreadTickets] = useState(0);

  const navItems = [
    { href: '/', labelKey: 'nav.home', iconKey: 'home' as const },
    { href: '/musique', labelKey: 'nav.music', iconKey: 'music' as const },
    { href: '/statements', labelKey: 'nav.revenue', iconKey: 'revenue' as const },
    { href: '/support', labelKey: 'support.title', iconKey: 'support' as const, badge: true },
  ];

  useEffect(() => {
    loadUnreadTickets();
    const interval = setInterval(loadUnreadTickets, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadUnreadTickets = async () => {
    try {
      const tickets = await getMyTickets();
      const total = tickets.reduce((sum, t) => sum + (t.unread_count || 0), 0);
      setUnreadTickets(total);
    } catch { /* silently ignore */ }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-divider safe-bottom z-50">
      <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const showBadge = item.badge && unreadTickets > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-colors"
            >
              <div className="relative">
                <svg
                  className={`w-5 h-5 transition-colors ${isActive ? 'text-primary' : 'text-default-400'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2 : 1.5} d={NAV_ICONS[item.iconKey]} />
                </svg>
                {showBadge && (
                  <span className="absolute -top-1 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-danger text-white text-[8px] font-bold">
                    {unreadTickets > 9 ? '9+' : unreadTickets}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-default-400'}`}>
                {t(item.labelKey)}
              </span>
              {/* Indicateur actif — point sous le label */}
              {isActive && (
                <div className="absolute bottom-0 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
