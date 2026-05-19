import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '@/lib/firebase';
import { APP_COLORS } from '@/lib/types';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 menit
const KEY_ATTEMPTS = '@ufound_login_attempts';
const KEY_LOCKOUT = '@ufound_lockout_until';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Cek status lockout saat komponen mount
  useEffect(() => {
    (async () => {
      const [[, att], [, lock]] = await AsyncStorage.multiGet([KEY_ATTEMPTS, KEY_LOCKOUT]);
      const attempts = parseInt(att ?? '0', 10);
      const lockUntil = parseInt(lock ?? '0', 10);
      setFailedAttempts(attempts);
      if (lockUntil > Date.now()) {
        setLockedUntil(lockUntil);
      } else if (lockUntil && lockUntil <= Date.now()) {
        await AsyncStorage.multiRemove([KEY_ATTEMPTS, KEY_LOCKOUT]);
      }
    })();
    return () => clearInterval(timerRef.current);
  }, []);

  // Countdown timer saat terkunci
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!lockedUntil) { setCountdown(0); return; }

    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        setLockedUntil(null);
        setCountdown(0);
        setFailedAttempts(0);
        AsyncStorage.multiRemove([KEY_ATTEMPTS, KEY_LOCKOUT]);
      } else {
        setCountdown(remaining);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && lockedUntil > Date.now();

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleLogin = async () => {
    if (isLocked) return;

    // Validasi input
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      Alert.alert('Error', 'Email dan password harus diisi');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      Alert.alert('Error', 'Format email tidak valid');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password minimal 6 karakter');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      // Login berhasil — reset counter
      await AsyncStorage.multiRemove([KEY_ATTEMPTS, KEY_LOCKOUT]);
      setFailedAttempts(0);
      router.replace('/');
    } catch (err: any) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      await AsyncStorage.setItem(KEY_ATTEMPTS, String(newAttempts));

      if (newAttempts >= MAX_ATTEMPTS) {
        // Kunci akun selama 5 menit
        const lockUntil = Date.now() + LOCKOUT_MS;
        setLockedUntil(lockUntil);
        await AsyncStorage.setItem(KEY_LOCKOUT, String(lockUntil));
        Alert.alert(
          'Akun Dikunci Sementara',
          'Terlalu banyak percobaan login gagal. Silakan coba lagi dalam 5 menit.'
        );
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts;
        let msg = 'Email atau password salah.';
        if (err.code === 'auth/invalid-email') msg = 'Format email tidak valid.';
        if (err.code === 'auth/too-many-requests') {
          msg = 'Terlalu banyak percobaan. Akun diblokir sementara oleh sistem.';
        }
        Alert.alert(
          'Login Gagal',
          `${msg}\n\n${remaining} percobaan tersisa sebelum akun dikunci.`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>U</Text>
          </View>
          <Text style={styles.appName}>UFound</Text>
          <Text style={styles.tagline}>Temukan Barangmu Kembali</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Masuk</Text>

          {/* Banner lockout */}
          {isLocked && (
            <View style={styles.lockoutBanner}>
              <Text style={styles.lockoutTitle}>Akun Dikunci Sementara</Text>
              <Text style={styles.lockoutSub}>
                Terlalu banyak percobaan gagal. Coba lagi dalam
              </Text>
              <Text style={styles.lockoutCountdown}>{formatCountdown(countdown)}</Text>
            </View>
          )}

          {/* Peringatan sisa percobaan */}
          {!isLocked && failedAttempts > 0 && failedAttempts < MAX_ATTEMPTS && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                {MAX_ATTEMPTS - failedAttempts} percobaan tersisa sebelum akun dikunci 5 menit
              </Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, isLocked && styles.inputDisabled]}
              placeholder="nama@email.com"
              placeholderTextColor={APP_COLORS.textLight}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLocked}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputWrapper, isLocked && styles.inputDisabled]}>
              <TextInput
                style={styles.inputInner}
                placeholder="Masukkan password"
                placeholderTextColor={APP_COLORS.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLocked}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={APP_COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, (loading || isLocked) && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading || isLocked}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isLocked ? `Terkunci (${formatCountdown(countdown)})` : 'Masuk'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Belum punya akun? </Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Daftar</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.primary },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: { fontSize: 36, fontWeight: '800', color: APP_COLORS.primary },
  appName: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  title: { fontSize: 22, fontWeight: '700', color: APP_COLORS.text, marginBottom: 16 },
  lockoutBanner: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: APP_COLORS.error,
  },
  lockoutTitle: { fontSize: 14, fontWeight: '700', color: APP_COLORS.error, marginBottom: 4 },
  lockoutSub: { fontSize: 12, color: APP_COLORS.error, textAlign: 'center' },
  lockoutCountdown: { fontSize: 28, fontWeight: '800', color: APP_COLORS.error, marginTop: 6 },
  warningBanner: {
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: APP_COLORS.warning,
  },
  warningText: { fontSize: 12, color: '#92400e', fontWeight: '600', textAlign: 'center' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: APP_COLORS.textMuted, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: APP_COLORS.text,
    backgroundColor: APP_COLORS.background,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    backgroundColor: APP_COLORS.background,
    paddingHorizontal: 14,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: APP_COLORS.text,
  },
  eyeBtn: { padding: 4 },
  inputDisabled: { opacity: 0.5, backgroundColor: APP_COLORS.border },
  button: {
    backgroundColor: APP_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: APP_COLORS.textMuted, fontSize: 14 },
  footerLink: { color: APP_COLORS.primary, fontSize: 14, fontWeight: '600' },
});
