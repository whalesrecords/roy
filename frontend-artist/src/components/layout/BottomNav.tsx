'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getMyTickets } from '@/lib/api';

const navItems = [
  {
    href: '/',
    label: 'Accueil',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    href: '/releases',
    label: 'Musique',
    icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z',
  },
  {
    href: '/statements',
    label: 'Wallet',
    icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  },
  {
    href: '/stats',
    label: 'Stats',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    href: '/support',
    label: 'Support',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    badge: true,
  },
  {
    href: '/settings',
    label: 'Profil',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [unreadTickets, setUnreadTickets] = useState(0);

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
    } catch {
      // silently ignore
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-content1/95 backdrop-blur-xl border-t border-divider safe-bottom z-50">
      <div className="flex items-center justify-around py-1.5 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const showBadge = item.badge && unreadTickets > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all ${
                isActive
                  ? 'text-primary'
                  : 'text-default-400 active:scale-95'
              }`}
            >
              <div className="relative">
                <svg className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.5 : 1.5} d={item.icon} />
                </svg>
                {showBadge && (
                  <span className="absolute -top-1 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-white text-[9px] font-bold">
                    {unreadTickets > 9 ? '9+' : unreadTickets}
                  </span>
                )}
              </div>
              <span className={`text-[9px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
