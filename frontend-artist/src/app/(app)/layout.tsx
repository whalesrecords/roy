'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import AppHeader from '@/components/layout/AppHeader';
import BottomNav from '@/components/layout/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { artist, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!artist) {
    return null;
  }

  return (
    <>
      <AppHeader />
      {children}
      <BottomNav />
    </>
  );
}
