/**
 * types.ts
 * Definisi tipe data global, konstanta kategori, dan palet warna aplikasi UFound.
 * File ini menjadi single source of truth untuk semua tipe yang digunakan lintas screen.
 */
import { Timestamp } from 'firebase/firestore';

/** Peran pengguna: 'user' untuk mahasiswa biasa, 'admin' untuk pengelola */
export type UserRole = 'user' | 'admin';

/** Data profil pengguna yang disimpan di koleksi Firestore 'users' */
export interface UserProfile {
  uid: string;
  name: string;
  nim: string;
  email: string;
  role: UserRole;
  createdAt: Timestamp;
  photoURL?: string;
}

/**
 * Alur status barang:
 * pending → available → claim_pending → claimed → completed
 * Barang 'pending' tidak muncul di feed user; hanya terlihat setelah admin menyetujui.
 */
export type ItemStatus = 'pending' | 'available' | 'claim_pending' | 'claimed' | 'completed';

/** Koordinat GPS dan alamat teks lokasi penemuan barang */
export interface ItemLocation {
  latitude: number;
  longitude: number;
  address: string;
}

/** Snapshot data penemu — disimpan denormalisasi agar tidak perlu join ke koleksi users */
export interface FoundByInfo {
  uid: string;
  name: string;
  nim: string;
}

/** Snapshot data pengklaim — sama seperti FoundByInfo, disimpan langsung di dokumen item */
export interface ClaimedByInfo {
  uid: string;
  name: string;
  nim: string;
}

/** Dokumen barang temuan di koleksi Firestore 'items' */
export interface Item {
  id: string;
  title: string;
  description: string;
  category: string;
  /** URL gambar publik dari Cloudinary (maks. 3) */
  images: string[];
  location: ItemLocation;
  foundBy: FoundByInfo;
  status: ItemStatus;
  /** Diisi saat status = 'claim_pending' atau 'claimed' */
  claimedBy?: ClaimedByInfo;
  claimedAt?: Timestamp;
  completedAt?: Timestamp;
  approvedAt?: Timestamp;
  createdAt: Timestamp;
  /** Bukti kepemilikan yang diisi user saat mengajukan klaim */
  claimProof?: {
    location: string;
    description: string;
  };
  /** Daftar UID user yang klaim-nya pernah ditolak admin; mencegah klaim ulang */
  rejectedClaimers?: string[];
}

/** Komentar pada barang temuan, disimpan di koleksi Firestore 'comments' */
export interface Comment {
  id: string;
  itemId: string;
  userId: string;
  userName: string;
  userNim: string;
  text: string;
  createdAt: Timestamp;
}

/** Daftar kategori barang yang tersedia; ikon menggunakan nama dari @expo/vector-icons Ionicons */
export const CATEGORIES = [
  { id: 'HP/Gadget', label: 'HP/Gadget', icon: 'phone-portrait-outline' },
  { id: 'Kartu/ID', label: 'Kartu/ID', icon: 'card-outline' },
  { id: 'Kunci', label: 'Kunci', icon: 'key-outline' },
  { id: 'Tas/Dompet', label: 'Tas/Dompet', icon: 'bag-handle-outline' },
  { id: 'Buku/ATK', label: 'Buku/ATK', icon: 'book-outline' },
  { id: 'Pakaian', label: 'Pakaian', icon: 'shirt-outline' },
  { id: 'Lainnya', label: 'Lainnya', icon: 'cube-outline' },
] as const;

/** Array string ID semua kategori, digunakan untuk validasi dan filter */
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

/** Palet warna global aplikasi UFound — gunakan ini, jangan hardcode warna di komponen */
export const APP_COLORS = {
  primary: '#003eb3',
  primaryDark: '#002d85',
  primaryLight: '#dce7ff',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  background: '#f1f5f9',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#11181C',
  textMuted: '#687076',
  textLight: '#94a3b8',
  white: '#ffffff',
  statusAvailable: '#22c55e',
  statusClaimed: '#f59e0b',
  statusCompleted: '#94a3b8',
};
