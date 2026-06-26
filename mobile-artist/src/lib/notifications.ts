import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { registerPushToken } from '@/lib/api';

// Show notifications even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permission, fetch the Expo push token and register it
 * with the backend so the label can push the artist (e.g. new promo feedback).
 * Best-effort: no-ops on simulators / when permission is denied.
 */
export async function syncPushRegistration(): Promise<void> {
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return;
    const projectId = (Constants.expoConfig as any)?.extra?.eas?.projectId;
    if (!projectId) return;
    const tok = await Notifications.getExpoPushTokenAsync({ projectId });
    if (tok?.data) await registerPushToken(tok.data, Platform.OS);
  } catch {
    // no device / no push credentials / offline — ignore
  }
}
