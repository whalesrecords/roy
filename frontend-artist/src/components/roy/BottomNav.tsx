'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export interface BottomNavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

/**
 * Mobile bottom navigation matching the ROY redesign prototypes.
 * Floats above the content with a translucent blur background. Active tab
 * uses --accent, inactive tabs use --text-3.
 */
export function BottomNav({ items }: { items: BottomNavItem[] }) {
  const pathname = usePathname();
  // Match the longest item prefix so /royalties/runs/abc still highlights "Royalties"
  const activeHref = items
    .map((it) => it.href)
    .filter((href) => pathname === href || pathname?.startsWith(href + '/'))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center px-3 pt-3 pb-[26px]
        border-t border-line backdrop-blur-[18px] -webkit-backdrop-filter:blur(18px)"
      style={{ background: 'var(--nav, rgba(14,16,20,0.82))' }}
    >
      {items.map((it) => {
        const active = it.href === activeHref;
        return (
          <Link
            key={it.href}
            href={it.href}
            className="flex flex-col items-center gap-1 px-2 py-1 transition-colors"
            style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}
          >
            <span className="w-[22px] h-[22px] flex items-center justify-center">{it.icon}</span>
            <span className="text-[9.5px] font-semibold">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
