import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
  KeyboardAvoidingView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import OSMMap from '@/components/OSMMap';
import QRCode from 'react-native-qrcode-svg';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Item, Comment, CATEGORIES, APP_COLORS } from '@/lib/types';
import { formatFull, format } from '@/lib/dateUtils';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { top: safeTop, bottom } = useSafeAreaInsets();
  const bottomInset = Math.max(bottom, 20);
  const { width: screenWidth } = useWindowDimensions();
  const [item, setItem] = useState<Item | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingClaim, setLoadingClaim] = useState(false);
  const [loadingComment, setLoadingComment] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimLocation, setClaimLocation] = useState('');
  const [claimDescription, setClaimDescription] = useState('');
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxRef = useRef<FlatList>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'items', id), (snap) => {
      if (snap.exists()) setItem({ id: snap.id, ...snap.data() } as Item);
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'comments'), where('itemId', '==', id));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment));
      data.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
      setComments(data);
    });
    return unsub;
  }, [id]);

  const handleClaim = () => {
    if (!item || !profile) return;
    setClaimLocation('');
    setClaimDescription('');
    setShowClaimForm(true);
  };

  const confirmClaim = async () => {
    if (!item || !profile) return;
    if (!claimLocation.trim()) {
      Alert.alert('Wajib Diisi', 'Masukkan lokasi kehilangan barang');
      return;
    }
    if (!claimDescription.trim()) {
      Alert.alert('Wajib Diisi', 'Masukkan deskripsi detail barang yang hilang');
      return;
    }
    setLoadingClaim(true);
    try {
      await updateDoc(doc(db, 'items', item.id), {
        status: 'claim_pending',
        claimedBy: { uid: profile.uid, name: profile.name, nim: profile.nim },
        claimedAt: serverTimestamp(),
        claimProof: {
          location: claimLocation.trim(),
          description: claimDescription.trim(),
        },
      });
      setShowClaimForm(false);
      Alert.alert('Pengajuan Terkirim', 'Klaimmu sedang dalam proses pengajuan. Admin akan meninjau dan menyetujui klaim kamu. Harap menunggu.');
    } catch {
      Alert.alert('Error', 'Gagal mengklaim barang');
    } finally {
      setLoadingClaim(false);
    }
  };

  const handleCancelClaim = () => {
    Alert.alert('Batalkan Klaim', 'Yakin ingin membatalkan klaim?', [
      { text: 'Tidak', style: 'cancel' },
      {
        text: 'Batalkan', style: 'destructive', onPress: async () => {
          if (!item) return;
          setLoadingClaim(true);
          try {
            await updateDoc(doc(db, 'items', item.id), {
              status: 'available',
              claimedBy: null,
              claimedAt: null,
            });
          } catch {
            Alert.alert('Error', 'Gagal membatalkan klaim');
          } finally {
            setLoadingClaim(false);
          }
        },
      },
    ]);
  };

  const handleShare = async () => {
    if (!item) return;
    const deepLink = `ufound://item/${item.id}`;
    const message = `🔍 Barang Temuan: ${item.title}\n📍 ${item.location?.address}\n🏷 ${item.category}\n\nBuka di UFound: ${deepLink}`;
    try {
      await Share.share({ message, title: item.title });
    } catch {}
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !profile || !id) return;
    setLoadingComment(true);
    try {
      await addDoc(collection(db, 'comments'), {
        itemId: id,
        userId: profile.uid,
        userName: profile.name,
        userNim: profile.nim,
        text: commentText.trim(),
        createdAt: serverTimestamp(),
      });
      setCommentText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Alert.alert('Error', 'Gagal mengirim komentar');
    } finally {
      setLoadingComment(false);
    }
  };

  if (!item) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={APP_COLORS.primary} />
      </View>
    );
  }

  const isMyClaimedItem = item.status === 'claimed' && item.claimedBy?.uid === profile?.uid;
  const isMyPendingClaim = item.status === 'claim_pending' && item.claimedBy?.uid === profile?.uid;
  const hasBeenRejected = !!profile?.uid && (item.rejectedClaimers?.includes(profile.uid) ?? false);
  const catIcon = (CATEGORIES.find((c) => c.id === item.category)?.icon ?? 'cube-outline') as any;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: item.status === 'available' ? bottomInset + 110 : bottomInset + 24 }}>
        {/* Images — swipe carousel */}
        {item.images?.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
                setCurrentImage(idx);
              }}
              style={{ width: screenWidth }}>
              {item.images.map((uri, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.9}
                  onPress={() => { setLightboxIndex(idx); setLightboxVisible(true); }}>
                  <Image
                    source={{ uri }}
                    style={[styles.mainImage, { width: screenWidth }]}
                    contentFit="cover"
                  />
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
            <Ionicons name={catIcon} size={64} color={APP_COLORS.primary} />
          </View>
        )}

        <View style={styles.content}>
          {/* Title + Status + Share */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{item.title}</Text>
            <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
              <Ionicons name="share-outline" size={20} color={APP_COLORS.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.metaRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '22' }]}>
              <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                {statusLabel(item.status)}
              </Text>
            </View>
            <View style={styles.categoryRow}>
              <Ionicons name={catIcon} size={13} color={APP_COLORS.textMuted} />
              <Text style={styles.categoryText}> {item.category}</Text>
            </View>
            <Text style={styles.dateText}>{format(item.createdAt)}</Text>
          </View>

          {item.description ? (
            <Text style={styles.description}>{item.description}</Text>
          ) : null}

          {/* WHO FOUND */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Yang Menemukan</Text>
            <View style={styles.finderCard}>
              <View style={styles.finderAvatar}>
                <Text style={styles.finderAvatarText}>{(item.foundBy?.name?.[0] ?? '?').toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.finderName}>{item.foundBy?.name ?? '-'}</Text>
                <Text style={styles.finderNim}>NIM: {item.foundBy?.nim ?? '-'}</Text>
              </View>
            </View>
          </View>

          {/* WHO CLAIMED */}
          {(item.status === 'claimed' || item.status === 'completed') && item.claimedBy && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Yang Mengklaim</Text>
              <View style={styles.finderCard}>
                <View style={[styles.finderAvatar, { backgroundColor: APP_COLORS.warning }]}>
                  <Text style={styles.finderAvatarText}>{(item.claimedBy?.name?.[0] ?? '?').toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.finderName}>{item.claimedBy?.name ?? '-'}</Text>
                  <Text style={styles.finderNim}>NIM: {item.claimedBy?.nim ?? '-'}</Text>
                  {item.claimedAt && (
                    <Text style={styles.claimedDate}>Diklaim: {formatFull(item.claimedAt)}</Text>
                  )}
                </View>
              </View>
              {item.status === 'completed' && item.completedAt && (
                <View style={styles.completedBanner}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={16} color={APP_COLORS.success} />
                <Text style={styles.completedText}>Barang telah diambil pada {formatFull(item.completedAt)}</Text>
              </View>
                </View>
              )}
            </View>
          )}

          {/* LOCATION MAP — only visible when completed */}
          {item.location?.latitude && item.status === 'completed' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Lokasi Ditemukan</Text>
              <View style={styles.locationAddressRow}>
                <Ionicons name="location-outline" size={13} color={APP_COLORS.textMuted} />
                <Text style={styles.locationAddress}>{item.location.address}</Text>
              </View>
              <OSMMap
                latitude={item.location.latitude}
                longitude={item.location.longitude}
                title={item.title}
              />
            </View>
          )}

          {/* WAITING FOR ADMIN APPROVAL */}
          {isMyPendingClaim && (
            <View style={styles.section}>
              <View style={styles.pendingClaimBox}>
                <Ionicons name="time-outline" size={28} color={APP_COLORS.primary} style={{ marginBottom: 8 }} />
                <Text style={styles.pendingClaimTitle}>Menunggu Konfirmasi Admin</Text>
                <Text style={styles.pendingClaimSub}>
                  Klaimmu sedang ditinjau oleh admin. Kamu akan mendapatkan QR code setelah klaim disetujui.
                </Text>
              </View>
              <TouchableOpacity style={styles.cancelClaimBtn} onPress={handleCancelClaim}>
                <Text style={styles.cancelClaimText}>Batalkan Pengajuan Klaim</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* QR CODE — only after admin approves (status = claimed) */}
          {isMyClaimedItem && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>QR Code Pengambilan</Text>
              <Text style={styles.qrHint}>
                Tunjukkan QR code ini kepada admin untuk mengambil barang
              </Text>
              <View style={styles.qrContainer}>
                <QRCode
                  value={item.id}
                  size={160}
                  color="#000000"
                  backgroundColor="#ffffff"
                />
              </View>
              <TouchableOpacity style={styles.cancelClaimBtn} onPress={handleCancelClaim}>
                <Text style={styles.cancelClaimText}>Batalkan Klaim</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* COMPLETED SUCCESS */}
          {item.status === 'completed' && item.claimedBy?.uid === profile?.uid && (
            <View style={styles.successBox}>
              <Ionicons name="trophy-outline" size={36} color={APP_COLORS.success} style={{ marginBottom: 8 }} />
              <Text style={styles.successTitle}>Pengambilan Berhasil!</Text>
              <Text style={styles.successSub}>Barang kamu sudah berhasil diambil. Terima kasih telah menggunakan UFound!</Text>
            </View>
          )}

          {/* CLAIMED / PENDING BY OTHERS */}
          {(item.status === 'claimed' || item.status === 'claim_pending') && item.claimedBy?.uid !== profile?.uid && (
            <View style={styles.claimedOtherBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="bookmark-outline" size={16} color={APP_COLORS.warning} />
                <Text style={styles.claimedOtherText}>Barang ini sedang dalam proses klaim oleh orang lain</Text>
              </View>
            </View>
          )}

          {/* CLAIM BUTTON */}
          {item.status === 'available' && profile?.uid !== item.foundBy?.uid && (
            hasBeenRejected ? (
              <View style={styles.rejectedBox}>
                <Ionicons name="ban-outline" size={20} color={APP_COLORS.error} style={{ marginBottom: 6 }} />
                <Text style={styles.rejectedTitle}>Klaim Ditolak</Text>
                <Text style={styles.rejectedSub}>
                  Pengajuan klaimmu sebelumnya telah ditolak oleh admin. Kamu tidak dapat mengklaim barang ini lagi.
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.claimBtn, loadingClaim && { opacity: 0.7 }]}
                onPress={handleClaim}
                disabled={loadingClaim}>
                {loadingClaim ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.claimBtnText}>Ini Milikku - Klaim Sekarang</Text>
                )}
              </TouchableOpacity>
            )
          )}

          {/* COMMENTS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Komentar & Feedback ({comments.length})</Text>
            {comments.length === 0 ? (
              <Text style={styles.noComments}>
                {item.status === 'available' ? 'Belum ada komentar. Jadilah yang pertama!' : 'Belum ada komentar.'}
              </Text>
            ) : (
              comments.map((c) => (
                <View key={c.id} style={styles.commentCard}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>{(c.userName?.[0] ?? '?').toUpperCase()}</Text>
                  </View>
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentName}>{c.userName}</Text>
                      <Text style={styles.commentNim}>NIM: {c.userNim}</Text>
                    </View>
                    <Text style={styles.commentText}>{c.text}</Text>
                    <Text style={styles.commentTime}>{format(c.createdAt)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Comment Input — only when available */}
      {item.status === 'available' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.commentInputArea, { paddingBottom: bottomInset + 12 }]}>
            <TextInput
              style={styles.commentInput}
              placeholder="Tulis komentar..."
              placeholderTextColor={APP_COLORS.textLight}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!commentText.trim() || loadingComment) && { opacity: 0.5 }]}
              onPress={handleSendComment}
              disabled={!commentText.trim() || loadingComment}>
              {loadingComment ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Lightbox Modal */}
      <Modal visible={lightboxVisible} transparent animationType="fade" onRequestClose={() => setLightboxVisible(false)}>
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity style={[styles.lightboxClose, { top: safeTop + 8 }]} onPress={() => setLightboxVisible(false)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <FlatList
            ref={lightboxRef}
            data={item.images}
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

      {/* Claim Form Modal */}
      <Modal visible={showClaimForm} transparent animationType="slide" onRequestClose={() => setShowClaimForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.claimModalOverlay}>
            <View style={[styles.claimModalCard, { paddingBottom: bottomInset + 20 }]}>
              <View style={styles.claimModalHeader}>
                <Text style={styles.claimModalTitle}>Verifikasi Kepemilikan</Text>
                <TouchableOpacity onPress={() => setShowClaimForm(false)}>
                  <Ionicons name="close" size={22} color={APP_COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.claimModalSub}>
                Isi form berikut sebagai bukti bahwa barang ini milikmu. Admin akan memverifikasi sebelum menyetujui pengambilan.
              </Text>

              <Text style={styles.claimFormLabel}>Lokasi Kehilangan *</Text>
              <TextInput
                style={styles.claimFormInput}
                placeholder="Contoh: Kantin Gedung B lantai 2, sekitar meja pojok..."
                placeholderTextColor={APP_COLORS.textLight}
                value={claimLocation}
                onChangeText={setClaimLocation}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={styles.claimFormLabel}>Deskripsi Detail Barang *</Text>
              <TextInput
                style={[styles.claimFormInput, { minHeight: 100 }]}
                placeholder="Sebutkan ciri khas barang seperti warna, merek, stiker, isi dompet, nama di kartu, dll..."
                placeholderTextColor={APP_COLORS.textLight}
                value={claimDescription}
                onChangeText={setClaimDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.claimSubmitBtn, loadingClaim && { opacity: 0.7 }]}
                onPress={confirmClaim}
                disabled={loadingClaim}>
                {loadingClaim ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.claimSubmitText}>Kirim & Klaim Barang</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
  return APP_COLORS.textLight;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mainImage: { height: 260 },
  imagePlaceholder: { height: 180, backgroundColor: APP_COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 10, backgroundColor: APP_COLORS.background },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: APP_COLORS.border },
  dotActive: { width: 20, backgroundColor: APP_COLORS.primary },
  content: { padding: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '800', color: APP_COLORS.text, flex: 1, marginRight: 10 },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: APP_COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700' },
  categoryRow: { flexDirection: 'row', alignItems: 'center' },
  categoryText: { fontSize: 13, color: APP_COLORS.textMuted },
  dateText: { fontSize: 12, color: APP_COLORS.textLight },
  description: { fontSize: 14, color: APP_COLORS.text, lineHeight: 22, marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: APP_COLORS.text, marginBottom: 12 },
  finderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  finderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: APP_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finderAvatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  finderName: { fontSize: 15, fontWeight: '700', color: APP_COLORS.text },
  finderNim: { fontSize: 13, color: APP_COLORS.textMuted, marginTop: 2 },
  claimedDate: { fontSize: 12, color: APP_COLORS.textLight, marginTop: 2 },
  completedBanner: {
    marginTop: 10,
    backgroundColor: APP_COLORS.success + '22',
    borderRadius: 10,
    padding: 12,
  },
  completedText: { fontSize: 13, color: APP_COLORS.success, fontWeight: '600' },
  locationAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  locationAddress: { fontSize: 13, color: APP_COLORS.textMuted, flex: 1 },
  qrHint: { fontSize: 13, color: APP_COLORS.textMuted, marginBottom: 16 },
  qrContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: APP_COLORS.border, overflow: 'hidden' },
  cancelClaimBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: APP_COLORS.error,
    alignItems: 'center',
  },
  cancelClaimText: { color: APP_COLORS.error, fontWeight: '600', fontSize: 14 },
  claimBtn: {
    backgroundColor: APP_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  claimBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  noComments: { fontSize: 14, color: APP_COLORS.textMuted, textAlign: 'center', paddingVertical: 20 },
  commentCard: { flexDirection: 'row', marginBottom: 14, gap: 10 },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: APP_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  commentAvatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  commentBody: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: APP_COLORS.border },
  commentHeader: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 },
  commentName: { fontSize: 13, fontWeight: '700', color: APP_COLORS.text },
  commentNim: { fontSize: 11, color: APP_COLORS.textLight },
  commentText: { fontSize: 13, color: APP_COLORS.text, lineHeight: 20 },
  commentTime: { fontSize: 11, color: APP_COLORS.textLight, marginTop: 4 },
  commentInputArea: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: APP_COLORS.border,
    gap: 10,
    alignItems: 'flex-end',
  },
  commentInput: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: APP_COLORS.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: APP_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 18 },
  successBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: APP_COLORS.success,
  },
successTitle: { fontSize: 16, fontWeight: '800', color: APP_COLORS.success, marginBottom: 4 },
  successSub: { fontSize: 13, color: APP_COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  claimedOtherBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: APP_COLORS.warning,
  },
  claimedOtherText: { fontSize: 14, fontWeight: '600', color: APP_COLORS.warning },
  pendingClaimBox: {
    backgroundColor: APP_COLORS.primaryLight,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: APP_COLORS.primary,
  },
  pendingClaimTitle: { fontSize: 15, fontWeight: '800', color: APP_COLORS.primary, marginBottom: 6 },
  pendingClaimSub: { fontSize: 13, color: APP_COLORS.primary, textAlign: 'center', lineHeight: 20, opacity: 0.8 },
  claimModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  claimModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  claimModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  claimModalTitle: { fontSize: 18, fontWeight: '800', color: APP_COLORS.text },
  claimModalSub: {
    fontSize: 13,
    color: APP_COLORS.textMuted,
    lineHeight: 20,
    marginBottom: 20,
  },
  claimFormLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: APP_COLORS.text,
    marginBottom: 6,
  },
  claimFormInput: {
    borderWidth: 1.5,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: APP_COLORS.text,
    backgroundColor: APP_COLORS.background,
    minHeight: 80,
    marginBottom: 16,
  },
  claimSubmitBtn: {
    backgroundColor: APP_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  claimSubmitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxClose: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 22,
  },
  lightboxDots: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  lightboxDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  lightboxDotActive: { backgroundColor: '#fff', width: 20 },
  rejectedBox: {
    backgroundColor: '#fff1f2',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: APP_COLORS.error,
  },
  rejectedTitle: { fontSize: 15, fontWeight: '800', color: APP_COLORS.error, marginBottom: 6 },
  rejectedSub: { fontSize: 13, color: APP_COLORS.error, textAlign: 'center', lineHeight: 20, opacity: 0.85 },
});
