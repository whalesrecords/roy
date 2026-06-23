import { InstallBanner } from '@/components/roy/InstallBanner';

export default function MobileDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <InstallBanner />
    </>
  );
}
