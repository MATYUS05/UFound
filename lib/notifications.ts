import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync(uid: string): Promise<void> {
  // Push notifications tidak didukung di Expo Go SDK 53+, hanya di production build
  if (Constants.executionEnvironment === 'storeClient') return;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'UFound',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#003eb3',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    await updateDoc(doc(db, 'users', uid), { expoPushToken: tokenData.data });
  } catch {}
}

export async function sendPushNotification(
  toUid: string,
  title: string,
  body: string
): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'users', toUid));
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.notificationsEnabled === false) return;
    const token: string | undefined = data.expoPushToken;
    if (!token) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default' }),
    });
  } catch {}
}
