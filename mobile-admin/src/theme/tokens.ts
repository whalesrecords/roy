/**
 * Design tokens « banque premium » — portés de l'app web (globals.css).
 * Light / Dark + accent paramétrable (mint/blue/gold/mono).
 */
export type Theme = 'light' | 'dark';
export type Accent = 'mint' | 'blue' | 'gold' | 'mono';

export const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: 'mint', label: 'Menthe', color: '#15CE8E' },
  { id: 'blue', label: 'Bleu', color: '#4D8DFF' },
  { id: 'gold', label: 'Or', color: '#E3B341' },
  { id: 'mono', label: 'Mono', color: '#9AA0A8' },
];

const ACCENT_COLORS: Record<Accent, { accent: string; accentSoft: string; accentInk: string }> = {
  mint: { accent: '#15CE8E', accentSoft: 'rgba(21, 206, 142, 0.13)', accentInk: '#06231A' },
  blue: { accent: '#4D8DFF', accentSoft: 'rgba(77, 141, 255, 0.13)', accentInk: '#06231A' },
  gold: { accent: '#E3B341', accentSoft: 'rgba(227, 179, 65, 0.15)', accentInk: '#06231A' },
  mono: { accent: '#9AA0A8', accentSoft: 'rgba(154, 160, 168, 0.16)', accentInk: '#06231A' },
};

export interface Palette {
  bg: string; surface: string; surface2: string; hero: string;
  border: string; borderStrong: string;
  text: string; text2: string; text3: string;
  neg: string; track: string; chrome: string;
  coverFrom: string; coverTo: string;
  accent: string; accentSoft: string; accentInk: string;
}

const LIGHT: Omit<Palette, 'accent' | 'accentSoft' | 'accentInk'> = {
  bg: '#F4F5F7', surface: '#FFFFFF', surface2: '#F8F9FA', hero: '#FFFFFF',
  border: 'rgba(15, 18, 24, 0.08)', borderStrong: 'rgba(15, 18, 24, 0.14)',
  text: '#14171C', text2: '#5B626C', text3: '#8A919B',
  neg: '#DC4C57', track: 'rgba(15, 18, 24, 0.07)', chrome: '#ECEEF1',
  coverFrom: '#E9ECF0', coverTo: '#DCE0E6',
};

const DARK: Omit<Palette, 'accent' | 'accentSoft' | 'accentInk'> = {
  bg: '#0A0B0D', surface: '#131519', surface2: '#1A1D22', hero: '#16191E',
  border: 'rgba(255, 255, 255, 0.07)', borderStrong: 'rgba(255, 255, 255, 0.13)',
  text: '#F3F4F6', text2: '#969CA5', text3: '#8E96A1',
  neg: '#F4707A', track: 'rgba(255, 255, 255, 0.07)', chrome: '#0E1014',
  coverFrom: '#23262C', coverTo: '#15171B',
};

export function makePalette(theme: Theme, accent: Accent): Palette {
  return { ...(theme === 'dark' ? DARK : LIGHT), ...ACCENT_COLORS[accent] };
}
