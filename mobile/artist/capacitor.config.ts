import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.whalesrecords.artist',
  appName: 'Whales Artists',
  webDir: 'www',
  bundledWebRuntime: false,
  server: {
    // Production artist portal (royalties-artist on Vercel). Change this
    // once the public hostname is wired (e.g. artists.whalesrecords.com).
    url: process.env.CAPACITOR_SERVER_URL || 'https://royalties-artist.vercel.app',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [
      '*.whalesrecords.com',
      'royalties-artist.vercel.app',
    ],
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0A0A0A',
  },
  android: {
    backgroundColor: '#0A0A0A',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0A0A0A',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A0A0A',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'native',
    },
  },
};

export default config;
