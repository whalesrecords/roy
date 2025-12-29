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
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  // Don't show nav on login page
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Show nav only when authenticated
  return (
    <div className="min-h-screen bg-default-50">
      {user && <Nav />}
      <main>{children}</main>
    </div>
  );
}
