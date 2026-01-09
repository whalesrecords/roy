import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MaintenanceProvider } from '@/contexts/MaintenanceContext';
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
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.add('light');
                  }
                } catch (e) {
                  document.documentElement.classList.add('light');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-background text-foreground min-h-screen`}>
        <ThemeProvider>
          <HeroUIProvider>
            <MaintenanceProvider>
              <AuthProvider>
                <AppShell>
                  {children}
                </AppShell>
              </AuthProvider>
            </MaintenanceProvider>
          </HeroUIProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
