import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useClaimNotification } from '@/hooks/useClaimNotification';
import ClaimNotificationBanner from '@/components/ClaimNotificationBanner';

export default function UserLayout() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const { notification, dismissNotification } = useClaimNotification();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/(auth)/login');
    else if (profile?.role === 'admin') router.replace('/(admin)/(tabs)');
  }, [user, profile, loading]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="item/[id]"
          options={{ headerShown: true, title: 'Detail Barang', headerBackTitle: 'Kembali', headerShadowVisible: false }}
        />
      </Stack>
      <ClaimNotificationBanner notification={notification} onDismiss={dismissNotification} />
    </View>
  );
}
