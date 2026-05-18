import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLayout() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/(auth)/login');
    else if (profile && profile.role !== 'admin') router.replace('/(user)/(tabs)');
  }, [user, profile, loading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="item/[id]"
        options={{ headerShown: true, title: 'Detail Barang', headerBackTitle: 'Kembali' }}
      />
    </Stack>
  );
}
