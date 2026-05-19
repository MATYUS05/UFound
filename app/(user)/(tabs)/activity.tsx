import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Item, CATEGORIES, APP_COLORS } from '@/lib/types';
import { format } from '@/lib/dateUtils';

type Tab = 'found' | 'claimed';

export default function ActivityScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { top, bottom } = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('found');
  const [foundItems, setFoundItems] = useState<Item[]>([]);
  const [claimedItems, setClaimedItems] = useState<Item[]>([]);
  const [loadingFound, setLoadingFound] = useState(true);
  const [loadingClaimed, setLoadingClaimed] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Item));
      setFoundItems(all.filter((i) => i.foundBy?.uid === profile.uid));
      setClaimedItems(all.filter((i) =>
        i.claimedBy?.uid === profile.uid ||
        (i.rejectedClaimers?.includes(profile.uid) ?? false)
      ));
      setLoadingFound(false);
      setLoadingClaimed(false);
    });
  }, [profile?.uid]);

  const items = activeTab === 'found' ? foundItems : claimedItems;
  const loading = activeTab === 'found' ? loadingFound : loadingClaimed;

  const statusLabel = (s: string) => {
    if (s === 'pending') return 'Menunggu';
    if (s === 'available') return 'Tersedia';
    if (s === 'claim_pending') return 'Klaim Ditinjau';
    if (s === 'claimed') return 'Diklaim';
    return 'Selesai';
  };
  const statusColor = (s: string) => {
    if (s === 'pending') return APP_COLORS.warning;
    if (s === 'available') return APP_COLORS.success;
    if (s === 'claim_pending') return APP_COLORS.primary;
    if (s === 'claimed') return APP_COLORS.primary;
    return APP_COLORS.textLight;
  };

  const renderItem = ({ item }: { item: Item }) => {
    const catIcon = (CATEGORIES.find((c) => c.id === item.category)?.icon ?? 'cube-outline') as any;
    const isRejected = activeTab === 'claimed' && (item.rejectedClaimers?.includes(profile?.uid ?? '') ?? false);
    const badgeColor = isRejected ? APP_COLORS.error : statusColor(item.status);
    const badgeLabel = isRejected ? 'Klaim Ditolak' : statusLabel(item.status);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(user)/item/${item.id}`)}>
        <View style={styles.cardEmoji}>
          <Ionicons name={catIcon} size={24} color={APP_COLORS.primary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardMeta}>{item.category}  ·  {format(item.createdAt)}</Text>
          <View style={styles.cardLocationRow}>
            <Ionicons name="location-outline" size={11} color={APP_COLORS.textMuted} />
            <Text style={styles.cardLocation} numberOfLines={1}> {item.location?.address || '-'}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${badgeColor}22` }]}>
          <Text style={[styles.statusText, { color: badgeColor }]}>
            {badgeLabel}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: top + 8 }]}>
        <Text style={styles.headerTitle}>Aktivitas Saya</Text>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'found' && styles.tabBtnActive]}
            onPress={() => setActiveTab('found')}>
            <View style={styles.tabBtnInner}>
              <Ionicons name="cube-outline" size={13} color={activeTab === 'found' ? APP_COLORS.primary : 'rgba(255,255,255,0.9)'} />
              <Text style={[styles.tabBtnText, activeTab === 'found' && styles.tabBtnTextActive]}>
                {' '}Saya Temukan ({foundItems.length})
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'claimed' && styles.tabBtnActive]}
            onPress={() => setActiveTab('claimed')}>
            <View style={styles.tabBtnInner}>
              <Ionicons name="bookmark-outline" size={13} color={activeTab === 'claimed' ? APP_COLORS.primary : 'rgba(255,255,255,0.9)'} />
              <Text style={[styles.tabBtnText, activeTab === 'claimed' && styles.tabBtnTextActive]}>
                {' '}Saya Klaim ({claimedItems.length})
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={APP_COLORS.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
          name={activeTab === 'found' ? 'cube-outline' : 'bookmark-outline'}
          size={48}
          color={APP_COLORS.textMuted}
          style={{ marginBottom: 12 }}
        />
          <Text style={styles.emptyTitle}>
            {activeTab === 'found' ? 'Belum ada barang yang kamu temukan' : 'Belum ada barang yang kamu klaim'}
          </Text>
          <Text style={styles.emptySub}>
            {activeTab === 'found'
              ? 'Laporkan barang temuan lewat tab Laporkan'
              : 'Klaim barang di tab Temuan jika itu milikmu'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[styles.list, { paddingBottom: 60 + bottom + 16 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.background },
  header: { backgroundColor: APP_COLORS.primary, paddingTop: 8, paddingBottom: 0, paddingHorizontal: 16 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 14 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: APP_COLORS.background },
  tabBtnInner: { flexDirection: 'row', alignItems: 'center' },
  tabBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  tabBtnTextActive: { color: APP_COLORS.primary },
  list: { padding: 16, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardEmoji: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: APP_COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: APP_COLORS.text, marginBottom: 2 },
  cardMeta: { fontSize: 11, color: APP_COLORS.textMuted, marginBottom: 2 },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center' },
  cardLocation: { fontSize: 11, color: APP_COLORS.textMuted, flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: APP_COLORS.text, textAlign: 'center', marginBottom: 6 },
  emptySub: { fontSize: 13, color: APP_COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
});
