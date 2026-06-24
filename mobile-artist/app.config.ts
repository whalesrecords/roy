import { ExpoConfig } from 'expo/config';

/**
 * Espace Artiste — Whales Records (app mobile native, Expo / React Native).
 * L'URL de l'API se règle via la variable d'env EXPO_PUBLIC_API_URL
 * (par défaut : production).
 */
const config: ExpoConfig = {
  name: 'Whales Records',
  slug: 'roy-artist',
  scheme: 'royartist',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0B0D',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.whalesrecords.artist',
  },
  android: {
    package: 'com.whalesrecords.artist',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A0B0D',
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.whalesrecords.com',
    eas: { projectId: '' },
  },
};

export default config;
