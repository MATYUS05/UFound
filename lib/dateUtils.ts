/**
 * dateUtils.ts
 * Helper untuk memformat Firestore Timestamp menjadi string tanggal relatif atau lengkap.
 * Mendukung dua format: relatif ("5 menit lalu") dan absolut (tanggal lengkap).
 */
import { Timestamp } from 'firebase/firestore';

/**
 * Mengubah Timestamp menjadi string waktu relatif dalam Bahasa Indonesia.
 * Contoh: "Baru saja", "5 menit lalu", "2 jam lalu", "3 hari lalu", atau tanggal lengkap.
 *
 * @param ts - Firestore Timestamp atau null/undefined
 * @returns String waktu relatif, atau string kosong jika ts tidak valid
 */
export function format(ts: Timestamp | undefined | null): string {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts as any);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Mengubah Timestamp menjadi string tanggal dan waktu lengkap dalam Bahasa Indonesia.
 * Contoh: "11 Juni 2026 pukul 14.30"
 *
 * @param ts - Firestore Timestamp atau null/undefined
 * @returns String tanggal lengkap, atau '-' jika ts tidak valid
 */
export function formatFull(ts: Timestamp | undefined | null): string {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts as any);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
