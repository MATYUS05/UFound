/**
 * app/(user)/(tabs)/profile.tsx — Halaman Profil Pengguna
 * Menampilkan informasi akun, tombol edit nama/NIM, toggle notifikasi push,
 * dan tombol logout. Perubahan profil langsung diperbarui ke Firestore dan
 * di-refresh ke AuthContext tanpa perlu re-login.
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { APP_COLORS } from '@/lib/types';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.name ?? '');
  const [nim, setNim] = useState(profile?.nim ?? '');
  const [saving, setSaving] = useState(false);
  const [togglingNotif, setTogglingNotif] = useState(false);
  const notificationsEnabled = profile?.notificationsEnabled !== false;

  /** Menyimpan perubahan nama dan NIM ke Firestore lalu memperbarui AuthContext */
  const handleSave = async () => {
    if (!name.trim() || !nim.trim()) {
      Alert.alert('Error', 'Nama dan NIM tidak boleh kosong');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile!.uid), {
        name: name.trim(),
        nim: nim.trim(),
      });
      await refreshProfile();
      setEditing(false);
      Alert.alert('Berhasil', 'Profil berhasil diperbarui');
    } catch {
      Alert.alert('Error', 'Gagal menyimpan profil');
    } finally {
      setSaving(false);
    }
  };

  /** Mengubah preferensi notifikasi push di Firestore; sendPushNotification akan mengecek field ini */
  const handleToggleNotifications = async (value: boolean) => {
    if (!profile) return;
    setTogglingNotif(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), { notificationsEnabled: value });
      await refreshProfile();
    } catch {
      Alert.alert('Error', 'Gagal mengubah pengaturan notifikasi');
    } finally {
      setTogglingNotif(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Keluar', 'Yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  // Inisial nama untuk avatar; fallback ke 'U' jika profil belum dimuat
  const avatarLetter = (profile?.name ?? 'U')[0].toUpperCase();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: top + 8 }]}>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 60 + bottom + 16 }]}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <View style={[styles.roleBadge, profile?.role === 'admin' && styles.roleBadgeAdmin]}>
            <Ionicons
              name={profile?.role === 'admin' ? 'shield-checkmark' : 'person'}
              size={13}
              color={APP_COLORS.text}
            />
            <Text style={styles.roleText}>{profile?.role === 'admin' ? ' Admin' : ' User'}</Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Informasi Akun</Text>
            {!editing && (
              <TouchableOpacity
                style={styles.editBtnRow}
                onPress={() => { setName(profile?.name ?? ''); setNim(profile?.nim ?? ''); setEditing(true); }}>
                <Ionicons name="pencil-outline" size={14} color={APP_COLORS.primary} />
                <Text style={styles.editBtn}> Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nama Lengkap</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Nama lengkap"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NIM</Text>
                <TextInput
                  style={styles.input}
                  value={nim}
                  onChangeText={setNim}
                  placeholder="NIM"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={handleSave}
                  disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Simpan</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {[
                { label: 'Nama Lengkap', value: profile?.name },
                { label: 'NIM', value: profile?.nim },
                { label: 'Email', value: profile?.email },
                { label: 'Role', value: profile?.role === 'admin' ? 'Administrator' : 'Pengguna' },
              ].map((item) => (
                <View key={item.label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value ?? '-'}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Notifications */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pengaturan</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={20} color={APP_COLORS.primary} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.settingLabel}>Notifikasi</Text>
                <Text style={styles.settingDesc}>Terima notifikasi saat laporan atau klaim disetujui</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              disabled={togglingNotif}
              trackColor={{ false: APP_COLORS.border, true: APP_COLORS.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={APP_COLORS.error} />
          <Text style={styles.logoutText}> Keluar dari Akun</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.background },
  header: { backgroundColor: APP_COLORS.primary, paddingTop: 8, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  content: { padding: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: APP_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarText: { fontSize: 36, fontWeight: '700', color: '#fff' },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: APP_COLORS.primaryLight,
  },
  roleBadgeAdmin: { backgroundColor: '#fef9c3' },
  roleText: { fontSize: 13, fontWeight: '700', color: APP_COLORS.text },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: APP_COLORS.text },
  editBtnRow: { flexDirection: 'row', alignItems: 'center' },
  editBtn: { fontSize: 13, color: APP_COLORS.primary, fontWeight: '600' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: APP_COLORS.border },
  infoLabel: { fontSize: 13, color: APP_COLORS.textMuted },
  infoValue: { fontSize: 14, fontWeight: '600', color: APP_COLORS.text, flex: 1, textAlign: 'right' },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: APP_COLORS.textMuted, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: APP_COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: APP_COLORS.text,
    backgroundColor: APP_COLORS.background,
  },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: APP_COLORS.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: APP_COLORS.textMuted },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: APP_COLORS.primary, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: APP_COLORS.text },
  settingDesc: { fontSize: 12, color: APP_COLORS.textMuted, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: APP_COLORS.error,
    marginBottom: 30,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: APP_COLORS.error },
});
