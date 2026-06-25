import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Accent, Palette, Theme, makePalette } from './tokens';

interface ThemeContextType {
  theme: Theme;
  accent: Accent;
  palette: Palette;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  setAccent: (a: Accent) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'admin-theme';
const ACCENT_KEY = 'admin-accent';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
  const [accent, setAccentState] = useState<Accent>('blue');

  useEffect(() => {
    (async () => {
      const savedTheme = (await AsyncStorage.getItem(THEME_KEY)) as Theme | null;
      const savedAccent = (await AsyncStorage.getItem(ACCENT_KEY)) as Accent | null;
      if (savedTheme) setThemeState(savedTheme);
      if (savedAccent) setAccentState(savedAccent);
    })();
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    AsyncStorage.setItem(THEME_KEY, t).catch(() => {});
  };
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
  const setAccent = (a: Accent) => {
    setAccentState(a);
    AsyncStorage.setItem(ACCENT_KEY, a).catch(() => {});
  };

  const palette = makePalette(theme, accent);

  return (
    <ThemeContext.Provider value={{ theme, accent, palette, toggleTheme, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

export function usePalette(): Palette {
  return useTheme().palette;
}
