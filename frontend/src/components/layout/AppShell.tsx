'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Nav from './Nav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Don't show nav on login page
  if (isLoginPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  // Show nav only when authenticated
  return (
    <>
      {user && <Nav />}
      <main className="min-h-screen">{children}</main>
    </>
  );
}
