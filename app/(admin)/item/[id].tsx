import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import OSMMap from '@/components/OSMMap';
import { db } from '@/lib/firebase';
import { Item, CATEGORIES, APP_COLORS } from '@/lib/types';
import { sendPushNotification } from '@/lib/notifications';
import { formatFull, format } from '@/lib/dateUtils';

export default function AdminItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { top: safeTop, bottom } = useSafeAreaInsets();
  const bottomInset = Math.max(bottom, 20);
  const { width: screenWidth } = useWindowDimensions();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxRef = useRef<FlatList>(null);

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
              updatedAt: serverTimestamp(),
            });
            sendPushNotification(
              item.foundBy.uid,
              'Laporan Disetujui ✅',
              `Barang "${item.title}" kamu telah disetujui dan dipublikasikan!`
            );
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

  const handleApproveClaim = () => {
    if (!item) return;
    Alert.alert('Setujui Klaim', 'Setujui klaim dan arahkan ke halaman scan QR?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Setujui',
        onPress: async () => {
          setLoading(true);
          try {
            await updateDoc(doc(db, 'items', item.id), { status: 'claimed', updatedAt: serverTimestamp() });
            sendPushNotification(
              item.claimedBy!.uid,
              'Klaim Disetujui ✅',
              `Klaim barang "${item.title}" telah disetujui. Tunjukkan QR code ke admin untuk mengambil barang.`
            );
            router.replace('/(admin)/(tabs)/scan');
          } catch { Alert.alert('Error', 'Gagal menyetujui klaim'); }
          finally { setLoading(false); }
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
            const isClaimRejection = item.status === 'claim_pending' && !!item.claimedBy?.uid;
            await updateDoc(doc(db, 'items', item.id), {
              status: 'available',
              claimedBy: null,
              claimedAt: null,
              completedAt: null,
              claimProof: null,
              updatedAt: serverTimestamp(),
              ...(isClaimRejection ? { rejectedClaimers: arrayUnion(item.claimedBy!.uid) } : {}),
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
          if (!item) return;
          setLoading(true);
          try {
            if (item.status === 'claim_pending' && item.claimedBy?.uid) {
              await updateDoc(doc(db, 'items', item.id), {
                rejectedClaimers: arrayUnion(item.claimedBy.uid),
              });
            }
            await deleteDoc(doc(db, 'items', item.id));
            router.back();
          } catch { Alert.alert('Error', 'Gagal menghapus'); }
          finally { setLoading(false); }
        },
      },
    ]);
  };

  if (!item) {
    return <View style={styles.center}><ActivityIndicator size="large" color={APP_COLORS.primary} /></View>;
  }

  const catIcon = (CATEGORIES.find((c) => c.id === item.category)?.icon ?? 'cube-outline') as any;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>
      {/* Images carousel */}
      {item.images?.some((u) => typeof u === 'string' && u.startsWith('http')) ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ width: screenWidth }}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              setCurrentImage(idx);
            }}>
            {item.images.filter((u): u is string => typeof u === 'string' && u.startsWith('http')).map((uri, idx) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.9}
                onPress={() => { setLightboxIndex(idx); setLightboxVisible(true); }}>
                <Image source={{ uri }} style={[styles.image, { width: screenWidth }]} contentFit="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
          {item.images.length > 1 && (
            <View style={styles.dotsRow}>
              {item.images.map((_, idx) => (
                <View key={idx} style={[styles.dot, currentImage === idx && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>
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

        {/* Claim Proof — visible when claim is pending review */}
        {item.status === 'claim_pending' && item.claimProof && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bukti Klaim</Text>
            <View style={styles.claimProofCard}>
              <View style={styles.claimProofRow}>
                <Ionicons name="location-outline" size={16} color={APP_COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.claimProofLabel}>Lokasi Kehilangan</Text>
                  <Text style={styles.claimProofValue}>{item.claimProof.location}</Text>
                </View>
              </View>
              <View style={[styles.claimProofRow, { marginTop: 12, borderTopWidth: 1, borderTopColor: APP_COLORS.border, paddingTop: 12 }]}>
                <Ionicons name="document-text-outline" size={16} color={APP_COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.claimProofLabel}>Deskripsi Barang</Text>
                  <Text style={styles.claimProofValue}>{item.claimProof.description}</Text>
                </View>
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

          {item.status === 'completed' ? (
            <View style={styles.completedNotice}>
              <Ionicons name="checkmark-circle" size={20} color={APP_COLORS.success} />
              <Text style={styles.completedNoticeText}>
                Barang ini sudah selesai diproses dan telah diambil oleh pemiliknya. Tidak ada tindakan lebih lanjut.
              </Text>
            </View>
          ) : item.status === 'claimed' ? (
            <View style={styles.claimedNotice}>
              <Ionicons name="qr-code-outline" size={20} color={APP_COLORS.primary} />
              <Text style={styles.claimedNoticeText}>
                Klaim telah disetujui. Tunggu pengguna datang membawa QR code untuk di-scan di halaman Scan.
              </Text>
            </View>
          ) : (
            <>
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

              {item.status === 'claim_pending' && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: APP_COLORS.success }]}
                  onPress={handleApproveClaim}
                  disabled={loading}>
                  <Text style={styles.actionBtnText}>Setujui Klaim</Text>
                </TouchableOpacity>
              )}

              {item.status === 'claim_pending' && (
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
            </>
          )}
        </View>
      </View>
      {/* Lightbox Modal */}
      <Modal visible={lightboxVisible} transparent animationType="fade" onRequestClose={() => setLightboxVisible(false)}>
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity style={[styles.lightboxClose, { top: safeTop + 8 }]} onPress={() => setLightboxVisible(false)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <FlatList
            ref={lightboxRef}
            data={item.images.filter((u): u is string => typeof u === 'string' && u.startsWith('http'))}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={lightboxIndex}
            getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item: uri }) => (
              <Image source={{ uri }} style={{ width: screenWidth, height: screenWidth * 1.2 }} contentFit="contain" />
            )}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              setLightboxIndex(idx);
            }}
          />
          {item.images.length > 1 && (
            <View style={styles.lightboxDots}>
              {item.images.map((_, idx) => (
                <View key={idx} style={[styles.lightboxDot, lightboxIndex === idx && styles.lightboxDotActive]} />
              ))}
            </View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

function statusLabel(s: string) {
  if (s === 'pending') return 'Menunggu Persetujuan';
  if (s === 'available') return 'Tersedia';
  if (s === 'claim_pending') return 'Klaim Ditinjau';
  if (s === 'claimed') return 'Diklaim';
  return 'Selesai';
}
function statusColor(s: string) {
  if (s === 'pending') return APP_COLORS.warning;
  if (s === 'available') return APP_COLORS.success;
  if (s === 'claim_pending') return APP_COLORS.primary;
  if (s === 'claimed') return APP_COLORS.warning;
  return APP_COLORS.textMuted;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { height: 220 },
  imagePlaceholder: { height: 150, backgroundColor: APP_COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 10, backgroundColor: APP_COLORS.background },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: APP_COLORS.border },
  dotActive: { width: 20, backgroundColor: APP_COLORS.primary },
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  lightboxClose: { position: 'absolute', right: 16, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 22 },
  lightboxDots: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  lightboxDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  lightboxDotActive: { backgroundColor: '#fff', width: 20 },
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
  claimProofCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  claimProofRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  claimProofLabel: { fontSize: 11, fontWeight: '700', color: APP_COLORS.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  claimProofValue: { fontSize: 14, color: APP_COLORS.text, lineHeight: 20 },
  completedNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: APP_COLORS.success + '15',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: APP_COLORS.success,
  },
  completedNoticeText: { flex: 1, fontSize: 14, color: APP_COLORS.success, fontWeight: '600', lineHeight: 20 },
  claimedNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: APP_COLORS.primaryLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: APP_COLORS.primary,
  },
  claimedNoticeText: { flex: 1, fontSize: 14, color: APP_COLORS.primary, fontWeight: '600', lineHeight: 20 },
});
