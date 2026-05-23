'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import AppHeader from '@/components/layout/AppHeader';
import BottomNav from '@/components/layout/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  // Always render the chrome (AppHeader + BottomNav) so the header
  // stays visible immediately on every page, even while auth is resolving.
  // AppHeader internally returns null when artist is not yet loaded.
  return (
    <>
      <AppHeader />
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" color="primary" />
        </div>
      ) : (
        children
      )}
      <BottomNav />
    </>
  );
}
