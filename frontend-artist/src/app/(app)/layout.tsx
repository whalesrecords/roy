'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import AppHeader from '@/components/layout/AppHeader';
import BottomNav from '@/components/layout/BottomNav';
import ArtistSidebar from '@/components/layout/ArtistSidebar';
import TopProgressBar from '@/components/roy/TopProgressBar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  return (
    <div className="lg:pl-[236px]">
      {/* Global loading progress bar */}
      <TopProgressBar />

      {/* Desktop chrome */}
      <ArtistSidebar />

      {/* Mobile chrome */}
      <AppHeader />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" color="primary" />
        </div>
      ) : (
        children
      )}

      <BottomNav />
    </div>
  );
}
