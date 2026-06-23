'use client';

import { BottomNav, BottomNavItem } from './BottomNav';

const ADMIN_TABS: BottomNavItem[] = [
  {
    href: '/dashboard',
    label: 'Bord',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/dashboard/royalties',
    label: 'Royalties',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
        <path d="M12 3v18M7 7h7a3 3 0 010 6H7m0 0h8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/artists',
    label: 'Artistes',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.5a3.2 3.2 0 010 6.4M21 20c0-2.6-1.4-4.4-3.5-5.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/finances',
    label: 'Finances',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function AdminBottomNav() {
  return <BottomNav items={ADMIN_TABS} />;
}
