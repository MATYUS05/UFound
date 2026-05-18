import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Item, CATEGORIES, APP_COLORS } from '@/lib/types';
import { format } from '@/lib/dateUtils';

type Tab = 'found' | 'claimed';

export default function ActivityScreen() {
  const router = useRouter();
  const { profile } = useAuth();
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
      setClaimedItems(all.filter((i) => i.claimedBy?.uid === profile.uid));
      setLoadingFound(false);
      setLoadingClaimed(false);
    });
  }, [profile?.uid]);

  const items = activeTab === 'found' ? foundItems : claimedItems;
  const loading = activeTab === 'found' ? loadingFound : loadingClaimed;

  const statusLabel = (s: string) =>
    s === 'available' ? 'Tersedia' : s === 'claimed' ? 'Diklaim' : 'Selesai';
  const statusColor = (s: string) =>
    s === 'available' ? APP_COLORS.success : s === 'claimed' ? APP_COLORS.warning : APP_COLORS.textLight;

  const renderItem = ({ item }: { item: Item }) => {
    const catEmoji = CATEGORIES.find((c) => c.id === item.category)?.emoji ?? '📦';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(user)/item/${item.id}`)}>
        <View style={styles.cardEmoji}>
          <Text style={styles.cardEmojiText}>{catEmoji}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardMeta}>{item.category}  ·  {format(item.createdAt)}</Text>
          <Text style={styles.cardLocation} numberOfLines={1}>📍 {item.location?.address || '-'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
            {statusLabel(item.status)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Aktivitas Saya</Text>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'found' && styles.tabBtnActive]}
            onPress={() => setActiveTab('found')}>
            <Text style={[styles.tabBtnText, activeTab === 'found' && styles.tabBtnTextActive]}>
              📦 Saya Temukan ({foundItems.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'claimed' && styles.tabBtnActive]}
            onPress={() => setActiveTab('claimed')}>
            <Text style={[styles.tabBtnText, activeTab === 'claimed' && styles.tabBtnTextActive]}>
              🔖 Saya Klaim ({claimedItems.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={APP_COLORS.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>{activeTab === 'found' ? '📦' : '🔖'}</Text>
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
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.background },
  header: { backgroundColor: APP_COLORS.primary, paddingTop: 56, paddingBottom: 0, paddingHorizontal: 16 },
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
  cardEmojiText: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: APP_COLORS.text, marginBottom: 2 },
  cardMeta: { fontSize: 11, color: APP_COLORS.textMuted, marginBottom: 2 },
  cardLocation: { fontSize: 11, color: APP_COLORS.textMuted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: APP_COLORS.text, textAlign: 'center', marginBottom: 6 },
  emptySub: { fontSize: 13, color: APP_COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
});
