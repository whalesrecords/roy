/**
 * Design tokens shared with the web redesign — these mirror the CSS variables
 * defined in `frontend/src/app/globals.css` so the native and PWA experiences
 * stay in sync. Update both sides together when the spec changes.
 */

export type ThemeMode = 'light' | 'dark';
export type AccentName = 'mint' | 'blue' | 'gold' | 'mono';

interface AccentTokens {
  accent: string;
  accentSoft: string;
  accentInk: string;
}

export const ACCENTS: Record<AccentName, AccentTokens> = {
  mint: { accent: '#15CE8E', accentSoft: 'rgba(21,206,142,0.13)', accentInk: '#06231A' },
  blue: { accent: '#4D8DFF', accentSoft: 'rgba(77,141,255,0.14)', accentInk: '#04122E' },
  gold: { accent: '#E3B341', accentSoft: 'rgba(227,179,65,0.15)', accentInk: '#2A1F02' },
  mono: { accent: '#E6E8EC', accentSoft: 'rgba(230,232,236,0.14)', accentInk: '#16181C' },
};

const SHARED = {
  neg: '#F4707A',
  radius: {
    card: 18,
    hero: 24,
    sheet: 30,
    pill: 999,
    button: 14,
  },
  spacing: { xs: 6, sm: 11, md: 14, lg: 20, xl: 28 },
  type: {
    eyebrow: { fontSize: 9.5, fontWeight: '500' as const, letterSpacing: 1.2, textTransform: 'uppercase' as const },
    h1: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.55 },
    h2: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.36 },
    heroNum: { fontSize: 46, fontWeight: '700' as const, letterSpacing: -1.6 },
    kpiNum: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.5 },
    body: { fontSize: 13.5, fontWeight: '500' as const },
    small: { fontSize: 11, fontWeight: '500' as const },
  },
};

export const DARK = {
  bg: '#0A0B0D',
  surface: '#131519',
  surface2: '#1A1D22',
  hero: '#16191E',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.13)',
  text: '#F3F4F6',
  text2: '#969CA5',
  text3: '#636973',
  track: 'rgba(255,255,255,0.08)',
  nav: 'rgba(14,16,20,0.92)',
  sheet: '#15181D',
  scrim: 'rgba(0,0,0,0.6)',
  ...SHARED,
};

export const LIGHT = {
  bg: '#F4F5F7',
  surface: '#FFFFFF',
  surface2: '#F4F6F8',
  hero: '#FFFFFF',
  border: 'rgba(15,18,24,0.08)',
  borderStrong: 'rgba(15,18,24,0.14)',
  text: '#14171C',
  text2: '#5B626C',
  text3: '#8A919B',
  track: 'rgba(15,18,24,0.07)',
  nav: 'rgba(255,255,255,0.92)',
  sheet: '#FFFFFF',
  scrim: 'rgba(20,23,28,0.38)',
  ...SHARED,
};

export type ThemeTokens = typeof DARK & AccentTokens;

export function buildTheme(mode: ThemeMode, accent: AccentName): ThemeTokens {
  const base = mode === 'dark' ? DARK : LIGHT;
  return { ...base, ...ACCENTS[accent] };
}

export const fontFamily = {
  // Until the Schibsted Grotesk TTF is loaded via expo-font we fall back to
  // platform-default SF Pro / Roboto. expo-font's onLoaded callback flips this.
  display: 'SchibstedGrotesk_700Bold',
  text: 'SchibstedGrotesk_500Medium',
  mono: 'IBMPlexMono_500Medium',
};

/** Numeric formatting helpers — kept here so the same logic runs across screens. */
export const fmtEUR = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
};

export const fmtMillions = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace('.', ',') + ' M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.', ',') + ' K';
  return String(n);
};

export const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
