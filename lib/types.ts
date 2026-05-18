import { Timestamp } from 'firebase/firestore';

export type UserRole = 'user' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  nim: string;
  email: string;
  role: UserRole;
  createdAt: Timestamp;
  photoURL?: string;
}

export type ItemStatus = 'pending' | 'available' | 'claimed' | 'completed';

export interface ItemLocation {
  latitude: number;
  longitude: number;
  address: string;
}

export interface FoundByInfo {
  uid: string;
  name: string;
  nim: string;
}

export interface ClaimedByInfo {
  uid: string;
  name: string;
  nim: string;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  category: string;
  images: string[];
  location: ItemLocation;
  foundBy: FoundByInfo;
  status: ItemStatus;
  claimedBy?: ClaimedByInfo;
  claimedAt?: Timestamp;
  completedAt?: Timestamp;
  approvedAt?: Timestamp;
  createdAt: Timestamp;
}

export interface Comment {
  id: string;
  itemId: string;
  userId: string;
  userName: string;
  userNim: string;
  text: string;
  createdAt: Timestamp;
}

export const CATEGORIES = [
  { id: 'HP/Gadget', label: 'HP/Gadget', icon: 'phone-portrait-outline' },
  { id: 'Kartu/ID', label: 'Kartu/ID', icon: 'card-outline' },
  { id: 'Kunci', label: 'Kunci', icon: 'key-outline' },
  { id: 'Tas/Dompet', label: 'Tas/Dompet', icon: 'bag-handle-outline' },
  { id: 'Buku/ATK', label: 'Buku/ATK', icon: 'book-outline' },
  { id: 'Pakaian', label: 'Pakaian', icon: 'shirt-outline' },
  { id: 'Lainnya', label: 'Lainnya', icon: 'cube-outline' },
] as const;

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

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
