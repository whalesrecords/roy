import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local notifications (no push server needed). Used to remind the admin to
 * import the royalty CSVs when the last import is getting old.
 */

const ENABLED_KEY = 'admin-notifications-enabled';
const LAST_IMPORT_NOTIFY_KEY = 'admin-notify-import-day'; // YYYY-MM-DD throttle

// Show notifications even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function notificationsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === '1';
}

export async function setNotificationsEnabled(on: boolean): Promise<boolean> {
  if (on) {
    const granted = await ensurePermission();
    if (!granted) return false;
  }
  await AsyncStorage.setItem(ENABLED_KEY, on ? '1' : '0').catch(() => {});
  return true;
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Fire a local reminder to import the CSVs, at most once per day, only when
 * notifications are enabled. `months` is how stale the last import is.
 */
export async function maybeNotifyImportReminder(months: number, lastDateLabel: string): Promise<void> {
  if (months < 1) return;
  if (!(await notificationsEnabled())) return;

  const last = await AsyncStorage.getItem(LAST_IMPORT_NOTIFY_KEY);
  if (last === todayKey()) return; // already reminded today

  const severity = months >= 3 ? '🔴' : months >= 2 ? '🟠' : '🟡';
  const body =
    months >= 3
      ? `Aucun import depuis ${lastDateLabel}. Importe les CSV au plus vite pour le calcul des royalties.`
      : `Dernier import : ${lastDateLabel}. Pense à importer les nouveaux CSV pour le calcul des royalties.`;

  await Notifications.scheduleNotificationAsync({
    content: { title: `${severity} Import des royalties à faire`, body },
    trigger: null, // present immediately
  }).catch(() => {});

  await AsyncStorage.setItem(LAST_IMPORT_NOTIFY_KEY, todayKey()).catch(() => {});
}
