import { InstallBanner } from '@/components/roy/InstallBanner';

export default function MobileArtistLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <InstallBanner />
    </>
  );
}
