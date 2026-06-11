/**
 * useClaimNotification.ts
 * Custom hook yang memantau perubahan status klaim secara real-time pada barang
 * milik user yang sedang login. Mendeteksi saat klaim baru disetujui admin dan
 * mengekspos data notifikasi untuk ditampilkan di ClaimNotificationBanner.
 */
import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export interface ClaimNotification {
  itemId: string;
  itemTitle: string;
  claimerName: string;
}

/**
 * Memantau semua barang milik user login dan men-trigger notifikasi
 * saat ada perubahan status menjadi 'claimed' (klaim baru disetujui admin).
 *
 * @returns notification - Data klaim terbaru, null jika tidak ada
 * @returns dismissNotification - Fungsi untuk menutup banner notifikasi
 */
export function useClaimNotification() {
  const { profile } = useAuth();
  const [notification, setNotification] = useState<ClaimNotification | null>(null);
  // Menyimpan status terakhir setiap item; menggunakan ref (bukan state) agar update
  // cache tidak menyebabkan re-render. Map<itemId, status>
  const prevStatusMap = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(
      collection(db, 'items'),
      where('foundBy.uid', '==', profile.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'removed') {
          prevStatusMap.current.delete(change.doc.id);
          return;
        }

        const data = change.doc.data();
        const prevStatus = prevStatusMap.current.get(change.doc.id);

        // Hanya notif jika status BARU berubah ke 'claimed' (bukan sudah claimed sebelumnya)
        if (
          change.type === 'modified' &&
          data.status === 'claimed' &&
          prevStatus !== 'claimed'
        ) {
          setNotification({
            itemId: change.doc.id,
            itemTitle: data.title ?? 'Barang',
            claimerName: data.claimedBy?.name ?? 'Seseorang',
          });
        }

        prevStatusMap.current.set(change.doc.id, data.status);
      });
    });

    return () => {
      unsub();
      prevStatusMap.current.clear();
    };
  }, [profile?.uid]);

  return {
    notification,
    dismissNotification: () => setNotification(null),
  };
}
