/**
 * AuthContext.tsx
 * Context global untuk state autentikasi dan profil pengguna.
 * Mendengarkan perubahan auth Firebase secara real-time dan mengambil
 * data profil dari Firestore setiap kali user login atau berganti.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

/**
 * Provider yang membungkus seluruh app untuk menyediakan AuthContext.
 * Harus diletakkan di root layout agar semua screen bisa mengakses data auth.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // loading=true sampai Firebase Auth selesai mengecek sesi yang tersimpan
  const [loading, setLoading] = useState(true);

  /** Mengambil dokumen profil dari Firestore berdasarkan UID */
  const fetchProfile = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        setProfile({ uid, ...snap.data() } as UserProfile);
      }
    } catch {
      setProfile(null);
    }
  };

  /** Memuat ulang profil dari Firestore; dipanggil setelah user mengedit profil */
  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook untuk mengakses AuthContext dari screen atau komponen mana pun */
export const useAuth = () => useContext(AuthContext);
