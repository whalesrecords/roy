import type { Config } from 'tailwindcss';
import { heroui } from '@heroui/react';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Schibsted Grotesk', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'IBM Plex Mono', 'monospace'],
      },
      colors: {
        // ── ROY redesign tokens (CSS-var backed → theme + accent aware) ──
        app: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
        },
        hero: 'var(--hero)',
        line: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        ink: {
          DEFAULT: 'var(--text)',
          muted: 'var(--text-2)',
          faint: 'var(--text-3)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          ink: 'var(--accent-ink)',
        },
        neg: 'var(--neg)',
        track: 'var(--track)',
        chrome: 'var(--chrome)',
      },
      borderRadius: {
        card: '20px',
        hero: '24px',
      },
      boxShadow: {
        roy: 'var(--shadow)',
      },
    },
  },
  darkMode: 'class',
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    heroui({
      themes: {
        light: {
          colors: {
            background: '#fafafa',        // zinc-50
            foreground: '#09090b',        // zinc-950
            primary: {
              50: '#eef2ff',
              100: '#e0e7ff',
              200: '#c7d2fe',
              300: '#a5b4fc',
              400: '#818cf8',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca',
              800: '#3730a3',
              900: '#312e81',
              DEFAULT: '#6366f1',
              foreground: '#ffffff',
            },
            success: {
              DEFAULT: '#10b981',
              foreground: '#ffffff',
            },
            warning: {
              DEFAULT: '#f59e0b',
              foreground: '#ffffff',
            },
            danger: {
              DEFAULT: '#ef4444',
              foreground: '#ffffff',
            },
            divider: '#e4e4e7',           // zinc-200 — discret
            content1: '#ffffff',          // carte principale
            content2: '#f4f4f5',          // zinc-100
            content3: '#e4e4e7',          // zinc-200
          },
        },
        dark: {
          colors: {
            background: '#09090b',        // zinc-950 — vrai noir neutre (pas bleuté)
            foreground: '#fafafa',        // zinc-50
            primary: {
              50: '#312e81',
              100: '#3730a3',
              200: '#4338ca',
              300: '#4f46e5',
              400: '#6366f1',
              500: '#818cf8',
              600: '#a5b4fc',
              700: '#c7d2fe',
              800: '#e0e7ff',
              900: '#eef2ff',
              DEFAULT: '#818cf8',         // indigo-400 — lisible sur fond sombre
              foreground: '#ffffff',
            },
            success: {
              DEFAULT: '#34d399',         // emerald-400
              foreground: '#022c22',
            },
            warning: {
              DEFAULT: '#fbbf24',
              foreground: '#451a03',
            },
            danger: {
              DEFAULT: '#f87171',         // red-400
              foreground: '#450a0a',
            },
            divider: 'rgba(255,255,255,0.07)',  // quasi-invisible, moderne
            content1: '#18181b',          // zinc-900 — surface carte
            content2: '#27272a',          // zinc-800 — surface élevée
            content3: '#3f3f46',          // zinc-700
          },
        },
      },
    }) as any,
  ],
};

export default config;
