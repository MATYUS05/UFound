import { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_COLORS } from '@/lib/types';
import { ClaimNotification } from '@/hooks/useClaimNotification';

interface Props {
  notification: ClaimNotification | null;
  onDismiss: () => void;
}

const BANNER_HIDDEN = -160;
const AUTO_DISMISS_MS = 5000;

export default function ClaimNotificationBanner({ notification, onDismiss }: Props) {
  const translateY = useRef(new Animated.Value(BANNER_HIDDEN)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const slideOut = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(translateY, {
      toValue: BANNER_HIDDEN,
      duration: 280,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  useEffect(() => {
    if (!notification) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    translateY.setValue(BANNER_HIDDEN);

    Animated.spring(translateY, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();

    timerRef.current = setTimeout(slideOut, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification?.itemId]);

  if (!notification) return null;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      <View style={styles.iconBox}>
        <Ionicons name="notifications" size={22} color="#fff" />
      </View>
      <View style={styles.textContent}>
        <Text style={styles.title}>Barang Kamu Diklaim!</Text>
        <Text style={styles.body} numberOfLines={2}>
          <Text style={styles.bold}>{notification.claimerName}</Text>
          {' '}mengklaim{' '}
          <Text style={styles.bold}>{notification.itemTitle}</Text>
        </Text>
      </View>
      <TouchableOpacity onPress={slideOut} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.primary,
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  body: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 17,
  },
  bold: {
    fontWeight: '700',
    color: '#fff',
  },
  closeBtn: {
    padding: 4,
  },
});
