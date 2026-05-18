import { useState } from 'react';
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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { APP_COLORS } from '@/lib/types';

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [nim, setNim] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name.trim() || !nim.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert('Error', 'Semua kolom harus diisi');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Password tidak cocok');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password minimal 6 karakter');
      return;
    }
    if (isAdmin && adminCode !== (process.env.EXPO_PUBLIC_ADMIN_CODE ?? 'ADMIN2024')) {
      Alert.alert('Error', 'Kode admin salah');
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        name: name.trim(),
        nim: nim.trim(),
        email: email.trim().toLowerCase(),
        role: isAdmin ? 'admin' : 'user',
        createdAt: serverTimestamp(),
      });
      router.replace('/');
    } catch (err: any) {
      let msg = 'Pendaftaran gagal.';
      if (err.code === 'auth/email-already-in-use') msg = 'Email sudah terdaftar.';
      if (err.code === 'auth/invalid-email') msg = 'Format email tidak valid.';
      if (err.code === 'auth/weak-password') msg = 'Password terlalu lemah.';
      Alert.alert('Gagal', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>U</Text>
          </View>
          <Text style={styles.appName}>UFound</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Daftar Akun</Text>

          {[
            { label: 'Nama Lengkap', value: name, setter: setName, placeholder: 'Nama kamu', keyboard: 'default' as const },
            { label: 'NIM', value: nim, setter: setNim, placeholder: '00000000000', keyboard: 'numeric' as const },
            { label: 'Email', value: email, setter: setEmail, placeholder: 'nama@email.com', keyboard: 'email-address' as const },
          ].map((field) => (
            <View key={field.label} style={styles.inputGroup}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                style={styles.input}
                placeholder={field.placeholder}
                placeholderTextColor={APP_COLORS.textLight}
                value={field.value}
                onChangeText={field.setter}
                keyboardType={field.keyboard}
                autoCapitalize={field.keyboard === 'default' ? 'words' : 'none'}
                autoCorrect={false}
              />
            </View>
          ))}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Min. 6 karakter"
              placeholderTextColor={APP_COLORS.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Konfirmasi Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Ulangi password"
              placeholderTextColor={APP_COLORS.textLight}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.adminToggle}
            onPress={() => setIsAdmin(!isAdmin)}>
            <View style={[styles.checkbox, isAdmin && styles.checkboxActive]}>
              {isAdmin && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.adminToggleText}>Daftar sebagai Admin</Text>
          </TouchableOpacity>

          {isAdmin && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Kode Admin</Text>
              <TextInput
                style={styles.input}
                placeholder="Masukkan kode admin"
                placeholderTextColor={APP_COLORS.textLight}
                value={adminCode}
                onChangeText={setAdminCode}
                secureTextEntry
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Daftar</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Sudah punya akun? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Masuk</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.primary },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 24 },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoText: { fontSize: 28, fontWeight: '800', color: APP_COLORS.primary },
  appName: { fontSize: 24, fontWeight: '800', color: '#fff' },
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
  title: { fontSize: 22, fontWeight: '700', color: APP_COLORS.text, marginBottom: 20 },
  inputGroup: { marginBottom: 14 },
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
  adminToggle: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: APP_COLORS.border,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: APP_COLORS.primary, borderColor: APP_COLORS.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  adminToggleText: { fontSize: 14, color: APP_COLORS.text },
  button: {
    backgroundColor: APP_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: APP_COLORS.textMuted, fontSize: 14 },
  footerLink: { color: APP_COLORS.primary, fontSize: 14, fontWeight: '600' },
});
