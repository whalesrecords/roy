'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Nav from './Nav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30">
            <span className="text-white font-bold text-lg">W</span>
          </div>
          <Spinner size="lg" color="primary" />
        </div>
      </div>
    );
  }

  // Don't show nav on login page
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Show sidebar layout when authenticated
  return (
    <div className="min-h-screen bg-background">
      {user && <Nav />}
      <main className={user ? 'lg:pl-60 pt-14 lg:pt-0' : ''}>
        {children}
      </main>
    </div>
  );
}
