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
    extend: {},
  },
  darkMode: 'class',
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: '#FFFFFF',
            foreground: '#1a1a2e',
            primary: {
              50: '#f0f4ff',
              100: '#e0e9ff',
              200: '#c7d7fe',
              300: '#a3bdfc',
              400: '#7c9af8',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca',
              800: '#3730a3',
              900: '#312e81',
              DEFAULT: '#6366f1',
              foreground: '#FFFFFF',
            },
            secondary: {
              50: '#f8fafc',
              100: '#f1f5f9',
              200: '#e2e8f0',
              300: '#cbd5e1',
              400: '#94a3b8',
              500: '#64748b',
              600: '#475569',
              700: '#334155',
              800: '#1e293b',
              900: '#0f172a',
              DEFAULT: '#64748b',
              foreground: '#FFFFFF',
            },
            success: {
              DEFAULT: '#10b981',
              foreground: '#FFFFFF',
            },
            warning: {
              DEFAULT: '#f59e0b',
              foreground: '#FFFFFF',
            },
            danger: {
              DEFAULT: '#ef4444',
              foreground: '#FFFFFF',
            },
            divider: '#e2e8f0',
            content2: '#f8fafc',
            content3: '#f1f5f9',
          },
        },
        dark: {
          colors: {
            background: '#0f172a',
            foreground: '#f8fafc',
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
              DEFAULT: '#818cf8',
              foreground: '#0f172a',
            },
            secondary: {
              50: '#0f172a',
              100: '#1e293b',
              200: '#334155',
              300: '#475569',
              400: '#64748b',
              500: '#94a3b8',
              600: '#cbd5e1',
              700: '#e2e8f0',
              800: '#f1f5f9',
              900: '#f8fafc',
              DEFAULT: '#94a3b8',
              foreground: '#0f172a',
            },
            success: {
              DEFAULT: '#34d399',
              foreground: '#0f172a',
            },
            warning: {
              DEFAULT: '#fbbf24',
              foreground: '#0f172a',
            },
            danger: {
              DEFAULT: '#f87171',
              foreground: '#0f172a',
            },
            divider: '#334155',
            content2: '#1e293b',
            content3: '#334155',
          },
        },
      },
    }),
  ],
};

export default config;
