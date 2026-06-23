import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import { AccentName, buildTheme, ThemeMode, ThemeTokens } from './theme';

interface ThemeContextValue {
  mode: ThemeMode;
  accent: AccentName;
  tokens: ThemeTokens;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const KEY_MODE = 'roy.theme.mode';
const KEY_ACCENT = 'roy.theme.accent';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(Appearance.getColorScheme() === 'light' ? 'light' : 'dark');
  const [accent, setAccentState] = useState<AccentName>('mint');

  useEffect(() => {
    // Hydrate from persisted prefs once on mount.
    AsyncStorage.multiGet([KEY_MODE, KEY_ACCENT]).then(([modeEntry, accentEntry]) => {
      const persistedMode = modeEntry[1] as ThemeMode | null;
      const persistedAccent = accentEntry[1] as AccentName | null;
      if (persistedMode === 'light' || persistedMode === 'dark') setModeState(persistedMode);
      if (persistedAccent && ['mint', 'blue', 'gold', 'mono'].includes(persistedAccent)) {
        setAccentState(persistedAccent);
      }
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(KEY_MODE, next).catch(() => undefined);
  }, []);

  const setAccent = useCallback((next: AccentName) => {
    setAccentState(next);
    AsyncStorage.setItem(KEY_ACCENT, next).catch(() => undefined);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, accent, tokens: buildTheme(mode, accent), setMode, setAccent }),
    [mode, accent, setMode, setAccent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
