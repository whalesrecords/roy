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

  useEffect(() => {
    // Theme — saved or system preference
    const savedTheme = localStorage.getItem('artist-theme') as Theme | null;
    if (savedTheme) {
      setThemeState(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setThemeState('dark');
      document.documentElement.classList.add('dark');
    }

    // Accent — saved or default mint
    const savedAccent = (localStorage.getItem('artist-accent') as Accent | null) || 'mint';
    setAccentState(savedAccent);
    document.documentElement.setAttribute('data-accent', savedAccent);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('artist-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  const setAccent = (newAccent: Accent) => {
    setAccentState(newAccent);
    localStorage.setItem('artist-accent', newAccent);
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
