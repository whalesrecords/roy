import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MaintenanceProvider } from '@/contexts/MaintenanceContext';
import AppShell from '@/components/layout/AppShell';
import { HeroUIProvider } from '@heroui/react';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900'],
});

export const metadata: Metadata = {
  title: 'Whales Records - SignFlow',
  description: 'Gestion des imports et royalties',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
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
      <body className={`${roboto.className} bg-background text-foreground min-h-screen`}>
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
