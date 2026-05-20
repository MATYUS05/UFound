import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/lib/firebase';
import { Item, APP_COLORS, CATEGORIES } from '@/lib/types';
import { formatFull, format } from '@/lib/dateUtils';

export default function AdminScanScreen() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [completedClaims, setCompletedClaims] = useState<Item[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'items'), where('status', '==', 'completed'));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Item));
      data.sort((a, b) => (b.completedAt?.toMillis?.() ?? 0) - (a.completedAt?.toMillis?.() ?? 0));
      setCompletedClaims(data);
      setHistoryLoading(false);
    });
  }, []);

  const handleBarcodeScan = async (data: string) => {
    if (scanned) return;
    setScanned(true);

    try {
      const snap = await getDoc(doc(db, 'items', data));
      if (!snap.exists()) {
        Alert.alert('Tidak Ditemukan', 'Barang dengan QR code ini tidak ada', [
          { text: 'Scan Lagi', onPress: () => setScanned(false) },
        ]);
        return;
      }
      const item = { id: snap.id, ...snap.data() } as Item;
      if (item.status !== 'claimed') {
        Alert.alert(
          'Status Tidak Valid',
          item.status === 'completed'
            ? 'Barang ini sudah selesai diambil'
            : 'Barang ini belum diklaim oleh siapapun',
          [{ text: 'Scan Lagi', onPress: () => setScanned(false) }]
        );
        return;
      }
      setScannedItem(item);
      setShowModal(true);
    } catch {
      Alert.alert('Error', 'Gagal memproses QR code', [
        { text: 'Scan Lagi', onPress: () => setScanned(false) },
      ]);
    }
  };

  const handleConfirm = async () => {
    if (!scannedItem) return;
    setConfirmLoading(true);
    try {
      await updateDoc(doc(db, 'items', scannedItem.id), {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowModal(false);
      setScannedItem(null);
      setScanned(false);
      Alert.alert('Berhasil ✅', `Barang "${scannedItem.title}" telah dikonfirmasi diambil!`);
    } catch {
      Alert.alert('Error', 'Gagal konfirmasi');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleReject = () => {
    setShowModal(false);
    setScannedItem(null);
    setScanned(false);
  };

  const catIcon = (cat: string) => (CATEGORIES.find((c) => c.id === cat)?.icon ?? 'cube-outline') as any;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: top + 8 }]}>
        <Text style={styles.headerTitle}>Scan & Konfirmasi</Text>
        <Text style={styles.headerSub}>Scan QR code dari pengambil barang</Text>
      </View>

      {/* CAMERA SECTION (top half) */}
      <View style={styles.cameraSection}>
        {permission?.granted ? (
          <View style={styles.cameraWrapper}>
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'qr'] }}
              onBarcodeScanned={scanned ? undefined : ({ data }) => handleBarcodeScan(data)}>
              <View style={styles.scanOverlay}>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.tl]} />
                  <View style={[styles.corner, styles.tr]} />
                  <View style={[styles.corner, styles.bl]} />
                  <View style={[styles.corner, styles.br]} />
                </View>
                <Text style={styles.scanHint}>
                  {scanned ? 'Memproses...' : 'Arahkan kamera ke QR code pengguna'}
                </Text>
              </View>
            </CameraView>
            {scanned && (
              <TouchableOpacity style={styles.rescanBtn} onPress={() => { setScanned(false); setScannedItem(null); }}>
                <Text style={styles.rescanBtnText}>Scan Lagi</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>Izin kamera diperlukan untuk scan barcode</Text>
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
              <Text style={styles.permissionBtnText}>Izinkan Kamera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* DIVIDER */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>HISTORY KLAIM</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* HISTORY SECTION (bottom half) */}
      <View style={styles.historySection}>
        {historyLoading ? (
          <ActivityIndicator color={APP_COLORS.primary} style={{ marginTop: 20 }} />
        ) : completedClaims.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryText}>Belum ada barang yang selesai diambil</Text>
          </View>
        ) : (
          <FlatList
            data={completedClaims}
            keyExtractor={(i) => i.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 60 + bottom + 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.historyCard}
                onPress={() => router.push(`/(admin)/item/${item.id}`)}
                activeOpacity={0.7}>
                <Ionicons name={catIcon(item.category)} size={28} color={APP_COLORS.primary} style={{ width: 36 }} />
                <View style={styles.historyInfo}>
                  <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.historyMeta}>
                    Diklaim: {item.claimedBy?.name} ({item.claimedBy?.nim})
                  </Text>
                  <Text style={styles.historyMeta}>
                    Diambil: {formatFull(item.completedAt)}
                  </Text>
                </View>
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>Selesai</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* CONFIRM MODAL */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Konfirmasi Pengambilan</Text>
            {scannedItem && (
              <>
                <View style={styles.modalItem}>
                  <Ionicons name={catIcon(scannedItem.category)} size={32} color={APP_COLORS.primary} />
                  <View>
                    <Text style={styles.modalItemName}>{scannedItem.title}</Text>
                    <Text style={styles.modalItemCategory}>{scannedItem.category}</Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Detail Pengambil:</Text>
                  <View style={styles.claimerCard}>
                    <Text style={styles.claimerName}>{scannedItem.claimedBy?.name}</Text>
                    <Text style={styles.claimerNim}>NIM: {scannedItem.claimedBy?.nim}</Text>
                    {scannedItem.claimedAt && (
                      <Text style={styles.claimerDate}>
                        Diklaim: {formatFull(scannedItem.claimedAt)}
                      </Text>
                    )}
                  </View>
                </View>

                <Text style={styles.modalQuestion}>
                  Apakah barang ini benar-benar sudah diambil?
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                    <Text style={styles.rejectBtnText}>Tidak</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, confirmLoading && { opacity: 0.7 }]}
                    onPress={handleConfirm}
                    disabled={confirmLoading}>
                    {confirmLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.confirmBtnText}>Ya, Konfirmasi</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.background },
  header: { backgroundColor: APP_COLORS.primary, paddingTop: 8, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  // Camera
  cameraSection: { flex: 1, backgroundColor: '#000' },
  permissionBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 16 },
  permissionText: { color: '#fff', fontSize: 15, textAlign: 'center' },
  permissionBtn: { backgroundColor: APP_COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cameraWrapper: { flex: 1 },
  camera: { flex: 1 },
  scanOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 220, height: 220, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#fff', borderWidth: 4 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanHint: { color: '#fff', marginTop: 30, fontSize: 14, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  rescanBtn: { position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' },
  rescanBtnText: { backgroundColor: APP_COLORS.primary, color: '#fff', fontWeight: '700', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, fontSize: 14 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: APP_COLORS.border },
  dividerText: { fontSize: 11, fontWeight: '700', color: APP_COLORS.textMuted, letterSpacing: 1 },

  // History
  historySection: { flex: 1, backgroundColor: '#fff' },
  emptyHistory: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 30 },
  emptyHistoryText: { fontSize: 14, color: APP_COLORS.textMuted },
  historyCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: APP_COLORS.border, gap: 12 },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: 14, fontWeight: '600', color: APP_COLORS.text },
  historyMeta: { fontSize: 12, color: APP_COLORS.textMuted, marginTop: 2 },
  completedBadge: { backgroundColor: APP_COLORS.success + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  completedBadgeText: { fontSize: 11, fontWeight: '700', color: APP_COLORS.success },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: APP_COLORS.text, marginBottom: 20, textAlign: 'center' },
  modalItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: APP_COLORS.primaryLight, borderRadius: 14, padding: 14, marginBottom: 16 },
  modalItemName: { fontSize: 16, fontWeight: '700', color: APP_COLORS.text },
  modalItemCategory: { fontSize: 13, color: APP_COLORS.textMuted },
  modalSection: { marginBottom: 16 },
  modalSectionTitle: { fontSize: 13, fontWeight: '700', color: APP_COLORS.textMuted, marginBottom: 8 },
  claimerCard: { backgroundColor: APP_COLORS.background, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: APP_COLORS.border },
  claimerName: { fontSize: 16, fontWeight: '700', color: APP_COLORS.text },
  claimerNim: { fontSize: 14, color: APP_COLORS.textMuted, marginTop: 2 },
  claimerDate: { fontSize: 12, color: APP_COLORS.textLight, marginTop: 4 },
  modalQuestion: { fontSize: 15, color: APP_COLORS.text, textAlign: 'center', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  rejectBtn: { flex: 1, paddingVertical: 15, borderRadius: 14, borderWidth: 2, borderColor: APP_COLORS.error, alignItems: 'center' },
  rejectBtnText: { fontSize: 15, fontWeight: '700', color: APP_COLORS.error },
  confirmBtn: { flex: 1, paddingVertical: 15, borderRadius: 14, backgroundColor: APP_COLORS.success, alignItems: 'center' },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
