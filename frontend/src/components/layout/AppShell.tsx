'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { Spinner } from '@heroui/react';
import Sidebar from './Sidebar';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Tableau de bord',
  '/artists': 'Artistes',
  '/catalog': 'Catalogue',
  '/imports': 'Imports',
  '/contracts': 'Contrats',
  '/finances': 'Finances',
  '/royalties': 'Royalties',
  '/inventory': 'Inventaire',
  '/analytics': 'Analytics',
  '/promo': 'Promo',
  '/tickets': 'Support',
  '/settings': 'Paramètres',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const base = '/' + pathname.split('/')[1];
  return PAGE_TITLES[base] || '';
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (isLoginPage || !user) {
    return <>{children}</>;
  }

  const pageTitle = getPageTitle(pathname);

  return (
    // h-screen + overflow-hidden bounds the layout so <main> becomes the real
    // scroll container. All page sticky headers can then use top-0.
    <div className="h-screen overflow-hidden bg-app flex">
      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[228px] overflow-hidden">
        {/* Mobile top bar — flex item, no sticky needed (bounded parent) */}
        <header className="lg:hidden flex-shrink-0 flex items-center gap-3 h-14 px-4 bg-surface border-b border-line z-30">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-1 rounded-xl text-ink-muted hover:bg-surface-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="w-[9px] h-[9px] rounded-[3px] bg-accent" />
          <span className="font-semibold text-sm text-ink">{pageTitle || 'ROY'}</span>
        </header>

        {/* Scroll container — ALL page content scrolls here */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
