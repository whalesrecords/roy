import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.whalesrecords.admin',
  appName: 'Whales Admin',
  // Empty webDir is fine when we use a remote `server.url` below.
  webDir: 'www',
  bundledWebRuntime: false,
  server: {
    // Production admin site. Capacitor loads this URL inside the native
    // WebView so every Vercel deploy goes live in the app instantly.
    // Override per-build via env: CAPACITOR_SERVER_URL=https://staging...
    url: process.env.CAPACITOR_SERVER_URL || 'https://admin.whalesrecords.com',
    cleartext: false,
    androidScheme: 'https',
    // Allow only whales subdomains to be navigated to from in-app links.
    allowNavigation: [
      '*.whalesrecords.com',
      'admin.whalesrecords.com',
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
