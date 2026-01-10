'use client';

import { HeroUIProvider } from '@heroui/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <HeroUIProvider>
          <AuthProvider>
            <ServiceWorkerRegistration />
            {children}
          </AuthProvider>
        </HeroUIProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
