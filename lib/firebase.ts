/**
 * firebase.ts
 * Inisialisasi Firebase (Auth + Firestore) dan helper upload gambar ke Cloudinary.
 * Singleton pattern digunakan agar Firebase tidak diinisialisasi ulang saat hot-reload.
 */
import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Cek getApps() agar tidak double-init saat hot-reload di Expo dev server
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// try/catch karena initializeAuth melempar error jika dipanggil lebih dari sekali (hot-reload)
let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

const db = getFirestore(app);

export { app, auth, db };

/**
 * Mengupload gambar ke Cloudinary menggunakan REST API (tanpa SDK resmi).
 * SDK Cloudinary tidak kompatibel dengan bundler React Native, sehingga
 * upload dilakukan manual via FormData + fetch ke endpoint v1_1.
 *
 * @param localUri - URI lokal file gambar dari expo-image-picker
 * @returns URL publik gambar (HTTPS) yang bisa langsung disimpan ke Firestore
 * @throws Error jika env variable tidak lengkap atau upload gagal
 */
export async function uploadImageToCloudinary(localUri: string): Promise<string> {
  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error('Konfigurasi Cloudinary tidak lengkap. Periksa file .env');
  }
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const formData = new FormData();
  formData.append('file', { uri: localUri, type: 'image/jpeg', name: 'upload.jpg' } as any);
  formData.append('upload_preset', uploadPreset!);

  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok || !data.secure_url) {
    throw new Error(data?.error?.message ?? 'Upload gambar gagal');
  }
  return data.secure_url as string;
}
