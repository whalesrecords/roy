'use client';

import { HeroUIProvider } from '@heroui/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <HeroUIProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </HeroUIProvider>
    </ThemeProvider>
  );
}
