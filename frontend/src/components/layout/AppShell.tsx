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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (isLoginPage || !user) {
    return <>{children}</>;
  }

  const pageTitle = getPageTitle(pathname);

  return (
    <div className="min-h-screen bg-content2 flex">
      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-56">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-content1 border-b border-divider">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-1 rounded-xl text-default-500 hover:bg-default-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">W</span>
          </div>
          <span className="font-semibold text-sm text-foreground">{pageTitle || 'Royalties'}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
