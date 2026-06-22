import type { Metadata, Viewport } from 'next';
import { Schibsted_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

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

export const metadata: Metadata = {
  title: 'Whales Records - Espace Artiste',
  description: 'Consultez vos revenus, statistiques et demandez vos paiements',
  manifest: '/manifest.json',
  icons: {
    icon: '/api/icon',
    apple: '/api/icon',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Whales Artists',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/api/icon" />
        <link rel="icon" href="/api/icon" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              var t=localStorage.getItem('artist-theme');
              if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}
              var a=localStorage.getItem('artist-accent')||'mint';
              document.documentElement.setAttribute('data-accent',a);
            }catch(e){document.documentElement.setAttribute('data-accent','mint');}})();`,
          }}
        />
      </head>
      <body className={`${sans.variable} ${mono.variable} font-sans bg-app text-ink min-h-screen antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
