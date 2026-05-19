import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { APP_COLORS } from '@/lib/types';

function LoadingDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: -10, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 350, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(400),
      ])
    ).start();
  }, []);

  return <Animated.View style={[styles.dot, { transform: [{ translateY: anim }] }]} />;
}

export default function Index() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const logoScale    = useRef(new Animated.Value(0)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY       = useRef(new Animated.Value(30)).current;
  const tagOpacity   = useRef(new Animated.Value(0)).current;
  const tagY         = useRef(new Animated.Value(20)).current;
  const ringScale    = useRef(new Animated.Value(0.8)).current;
  const ringOpacity  = useRef(new Animated.Value(0.6)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const dotsOpacity  = useRef(new Animated.Value(0)).current;

  const [animDone, setAnimDone] = useState(false);

  useEffect(() => {
    // Pulsing ring around logo
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale,   { toValue: 1.6, duration: 1000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0,   duration: 1000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale,   { toValue: 0.8, duration: 0, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();

    // Entrance sequence
    Animated.sequence([
      // Logo springs in
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 55, friction: 6, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.delay(80),
      // App name slides up
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(titleY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(80),
      // Tagline fades up
      Animated.parallel([
        Animated.timing(tagOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(tagY,       { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
      // Dots loader appears
      Animated.timing(dotsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      // Minimum display time
      Animated.delay(900),
    ]).start(() => setAnimDone(true));
  }, []);

  useEffect(() => {
    if (!animDone || loading) return;

    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 450,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      if (!user) router.replace('/(auth)/login');
      else if (profile?.role === 'admin') router.replace('/(admin)/(tabs)');
      else router.replace('/(user)/(tabs)');
    });
  }, [animDone, loading, user, profile, router]);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      {/* Decorative background circles */}
      <View style={styles.bgCircleTop} />
      <View style={styles.bgCircleBottom} />

      {/* Center content */}
      <View style={styles.center}>
        {/* Logo area */}
        <View style={styles.logoArea}>
          <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          <Animated.View style={[styles.logoWrapper, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoLetter}>U</Text>
            </View>
          </Animated.View>
        </View>

        <Animated.Text style={[styles.appName, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
          UFound
        </Animated.Text>

        <Animated.Text style={[styles.tagline, { opacity: tagOpacity, transform: [{ translateY: tagY }] }]}>
          Temukan Barangmu Kembali
        </Animated.Text>
      </View>

      {/* Bottom loading dots */}
      <Animated.View style={[styles.bottom, { opacity: dotsOpacity }]}>
        <View style={styles.dots}>
          <LoadingDot delay={0} />
          <LoadingDot delay={160} />
          <LoadingDot delay={320} />
        </View>
        <Text style={styles.version}>UFound · Universitas Multimedia Nusantara</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_COLORS.primary,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 80,
  },
  bgCircleTop: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -80,
    right: -80,
  },
  bgCircleBottom: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -60,
    left: -60,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoArea: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  logoWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLetter: {
    fontSize: 44,
    fontWeight: '900',
    color: APP_COLORS.primary,
  },
  appName: {
    fontSize: 38,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.5,
  },
  bottom: {
    alignItems: 'center',
    gap: 14,
  },
  dots: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    height: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  version: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.3,
  },
});
