import type { Metadata, Viewport } from 'next';
import { Schibsted_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MaintenanceProvider } from '@/contexts/MaintenanceContext';
import AppShell from '@/components/layout/AppShell';
import { HeroUIProvider } from '@heroui/react';

const sans = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#6366f1',
};

export const metadata: Metadata = {
  title: 'Whales Records - Admin',
  description: 'Gestion des imports et royalties',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WR Admin',
  },
  icons: {
    icon: '/api/icon',
    apple: '/api/icon',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
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
                  var accent = localStorage.getItem('accent') || 'mint';
                  document.documentElement.setAttribute('data-accent', accent);
                } catch (e) {
                  document.documentElement.classList.add('light');
                  document.documentElement.setAttribute('data-accent', 'mint');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${sans.variable} ${mono.variable} font-sans bg-background text-foreground min-h-screen`}>
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
