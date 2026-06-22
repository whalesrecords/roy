'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
export type Accent = 'mint' | 'blue' | 'gold' | 'mono';

export const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: 'mint', label: 'Menthe', color: '#15CE8E' },
  { id: 'blue', label: 'Bleu', color: '#4D8DFF' },
  { id: 'gold', label: 'Or', color: '#E3B341' },
  { id: 'mono', label: 'Mono', color: '#9AA0A8' },
];

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [accent, setAccentState] = useState<Accent>('mint');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Theme — saved or system preference
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      setThemeState(savedTheme);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setThemeState('dark');
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.add('light');
    }

    // Accent — saved or default mint
    const savedAccent = (localStorage.getItem('accent') as Accent | null) || 'mint';
    setAccentState(savedAccent);
    document.documentElement.setAttribute('data-accent', savedAccent);

    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setAccent = (newAccent: Accent) => {
    setAccentState(newAccent);
    localStorage.setItem('accent', newAccent);
    document.documentElement.setAttribute('data-accent', newAccent);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
