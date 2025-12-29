import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { HeroUIProvider } from '@heroui/react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Royalties Admin',
  description: 'Gestion des imports et royalties',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <HeroUIProvider>
          <AuthProvider>
            <AppShell>
              {children}
            </AppShell>
          </AuthProvider>
        </HeroUIProvider>
      </body>
    </html>
  );
}
