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
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.whalesrecords.artist',
  },
  android: {
    package: 'com.whalesrecords.artist',
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.whalesrecords.com',
    eas: { projectId: '' },
  },
};

export default config;
