import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import OSMMap from '@/components/OSMMap';
import { db } from '@/lib/firebase';
import { Item, CATEGORIES, APP_COLORS } from '@/lib/types';
import { formatFull, format } from '@/lib/dateUtils';

export default function AdminItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'items', id), (snap) => {
      if (snap.exists()) setItem({ id: snap.id, ...snap.data() } as Item);
    });
    return unsub;
  }, [id]);

  const handleApprove = () => {
    if (!item) return;
    Alert.alert('Setujui Laporan', 'Barang akan dipublikasikan ke halaman utama?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Setujui',
        onPress: async () => {
          setLoading(true);
          try {
            await updateDoc(doc(db, 'items', item.id), {
              status: 'available',
              approvedAt: serverTimestamp(),
            });
          } catch { Alert.alert('Error', 'Gagal menyetujui laporan'); }
          finally { setLoading(false); }
        },
      },
    ]);
  };

  const handleReject = () => {
    if (!item) return;
    Alert.alert('Tolak Laporan', 'Laporan akan dihapus dari sistem?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Tolak & Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'items', item.id));
            router.back();
          } catch { Alert.alert('Error', 'Gagal menolak laporan'); }
        },
      },
    ]);
  };

  const handleSetAvailable = async () => {
    if (!item) return;
    Alert.alert('Ubah Status', 'Set barang menjadi Tersedia (batalkan klaim)?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Ya',
        onPress: async () => {
          setLoading(true);
          try {
            await updateDoc(doc(db, 'items', item.id), {
              status: 'available',
              claimedBy: null,
              claimedAt: null,
              completedAt: null,
            });
          } catch { Alert.alert('Error', 'Gagal update status'); }
          finally { setLoading(false); }
        },
      },
    ]);
  };

  const handleMarkCompleted = async () => {
    if (!item) return;
    Alert.alert('Selesaikan', 'Konfirmasi barang sudah diambil?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Konfirmasi',
        onPress: async () => {
          setLoading(true);
          try {
            await updateDoc(doc(db, 'items', item.id), {
              status: 'completed',
              completedAt: serverTimestamp(),
            });
          } catch { Alert.alert('Error', 'Gagal update status'); }
          finally { setLoading(false); }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Hapus Barang', `Yakin hapus "${item?.title}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'items', item!.id));
            router.back();
          } catch { Alert.alert('Error', 'Gagal menghapus'); }
        },
      },
    ]);
  };

  if (!item) {
    return <View style={styles.center}><ActivityIndicator size="large" color={APP_COLORS.primary} /></View>;
  }

  const catIcon = (CATEGORIES.find((c) => c.id === item.category)?.icon ?? 'cube-outline') as any;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Image */}
      {item.images?.length > 0 && typeof item.images[0] === 'string' && item.images[0].startsWith('http') ? (
        <Image source={{ uri: item.images[0] }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name={catIcon} size={60} color={APP_COLORS.primary} />
        </View>
      )}

      <View style={styles.content}>
        {/* Title + Status */}
        <Text style={styles.title}>{item.title}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '22' }]}>
            <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
              {statusLabel(item.status)}
            </Text>
          </View>
          <Text style={styles.metaText}>{item.category}</Text>
          <Text style={styles.metaText}>{format(item.createdAt)}</Text>
        </View>

        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

        {/* Found By */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yang Menemukan</Text>
          <View style={styles.personCard}>
            <View style={[styles.personAvatar, { backgroundColor: APP_COLORS.primary }]}>
              <Text style={styles.personAvatarText}>{(item.foundBy?.name?.[0] ?? '?').toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.personName}>{item.foundBy?.name ?? '-'}</Text>
              <Text style={styles.personNim}>NIM: {item.foundBy?.nim ?? '-'}</Text>
            </View>
          </View>
        </View>

        {/* Claimed By (if applicable) */}
        {item.claimedBy && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Yang Mengklaim</Text>
            <View style={styles.personCard}>
              <View style={[styles.personAvatar, { backgroundColor: APP_COLORS.warning }]}>
                <Text style={styles.personAvatarText}>{(item.claimedBy?.name?.[0] ?? '?').toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{item.claimedBy.name}</Text>
                <Text style={styles.personNim}>NIM: {item.claimedBy.nim}</Text>
                {item.claimedAt && (
                  <Text style={styles.personDate}>Klaim: {formatFull(item.claimedAt)}</Text>
                )}
                {item.completedAt && (
                  <Text style={[styles.personDate, { color: APP_COLORS.success }]}>
                    Diambil: {formatFull(item.completedAt)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Location */}
        {item.location?.latitude && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lokasi Ditemukan</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={APP_COLORS.textMuted} />
              <Text style={styles.locationText}>{item.location.address}</Text>
            </View>
            <OSMMap
              latitude={item.location.latitude}
              longitude={item.location.longitude}
              title={item.title}
            />
          </View>
        )}

        {/* Admin Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tindakan Admin</Text>

          {item.status === 'pending' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: APP_COLORS.success }]}
                onPress={handleApprove}
                disabled={loading}>
                <Text style={styles.actionBtnText}>Setujui & Publikasikan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: APP_COLORS.error, marginTop: 10 }]}
                onPress={handleReject}
                disabled={loading}>
                <Text style={styles.actionBtnText}>Tolak & Hapus Laporan</Text>
              </TouchableOpacity>
            </>
          )}

          {item.status === 'claimed' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: APP_COLORS.success }]}
              onPress={handleMarkCompleted}
              disabled={loading}>
              <Text style={styles.actionBtnText}>Konfirmasi Sudah Diambil</Text>
            </TouchableOpacity>
          )}

          {(item.status === 'claimed' || item.status === 'completed') && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: APP_COLORS.warning, marginTop: 10 }]}
              onPress={handleSetAvailable}
              disabled={loading}>
              <Text style={styles.actionBtnText}>Kembalikan ke Tersedia</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: APP_COLORS.error, marginTop: 10 }]}
            onPress={handleDelete}
            disabled={loading}>
            <Text style={styles.actionBtnText}>Hapus Barang</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function statusLabel(s: string) {
  return s === 'pending' ? 'Menunggu Persetujuan' :
    s === 'available' ? 'Tersedia' :
    s === 'claimed' ? 'Diklaim' : 'Selesai';
}
function statusColor(s: string) {
  return s === 'pending' ? APP_COLORS.warning :
    s === 'available' ? APP_COLORS.success :
    s === 'claimed' ? APP_COLORS.warning : APP_COLORS.textMuted;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: 220 },
  imagePlaceholder: { height: 150, backgroundColor: APP_COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20 },
  title: { fontSize: 20, fontWeight: '800', color: APP_COLORS.text, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700' },
  metaText: { fontSize: 13, color: APP_COLORS.textMuted },
  description: { fontSize: 14, color: APP_COLORS.text, lineHeight: 22, marginBottom: 20 },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: APP_COLORS.text, marginBottom: 12 },
  personCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 14, borderWidth: 1, borderColor: APP_COLORS.border },
  personAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  personAvatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  personName: { fontSize: 15, fontWeight: '700', color: APP_COLORS.text },
  personNim: { fontSize: 13, color: APP_COLORS.textMuted, marginTop: 2 },
  personDate: { fontSize: 12, color: APP_COLORS.textLight, marginTop: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  locationText: { fontSize: 13, color: APP_COLORS.textMuted, flex: 1 },
  actionBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
