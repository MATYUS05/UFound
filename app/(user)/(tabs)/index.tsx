import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, orderBy, onSnapshot, QueryConstraint } from 'firebase/firestore';
import { Image } from 'expo-image';
import { db } from '@/lib/firebase';
import { Item, CATEGORIES, APP_COLORS, ItemStatus } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { format } from '@/lib/dateUtils';

const STATUS_LABELS: Record<ItemStatus, string> = {
  available: 'Tersedia',
  claimed: 'Diklaim',
  completed: 'Selesai',
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  available: APP_COLORS.statusAvailable,
  claimed: APP_COLORS.statusClaimed,
  completed: APP_COLORS.statusCompleted,
};

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [filtered, setFiltered] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ItemStatus | ''>('');

  useEffect(() => {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    const q = query(collection(db, 'items'), ...constraints);
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Item));
      setItems(data);
      setLoading(false);
      setRefreshing(false);
    });
  }, []);

  useEffect(() => {
    let result = [...items];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.location?.address?.toLowerCase().includes(q) ||
          i.foundBy?.name?.toLowerCase().includes(q)
      );
    }
    if (selectedCategory) result = result.filter((i) => i.category === selectedCategory);
    if (selectedStatus) result = result.filter((i) => i.status === selectedStatus);
    setFiltered(result);
  }, [items, search, selectedCategory, selectedStatus]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(user)/item/${item.id}`)}>
      {item.images?.length > 0 ? (
        <Image source={{ uri: item.images[0] }} style={styles.cardImage} contentFit="cover" />
      ) : (
        <View style={styles.cardImagePlaceholder}>
          <Text style={styles.categoryEmoji}>
            {CATEGORIES.find((c) => c.id === item.category)?.emoji ?? '📦'}
          </Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[item.status]}22` }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
              {STATUS_LABELS[item.status]}
            </Text>
          </View>
        </View>
        <Text style={styles.cardCategory}>
          {CATEGORIES.find((c) => c.id === item.category)?.emoji} {item.category}
        </Text>
        <Text style={styles.cardLocation} numberOfLines={1}>
          📍 {item.location?.address || 'Lokasi tidak tersedia'}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardFinder} numberOfLines={1}>👤 {item.foundBy?.name ?? 'Anonim'}  ·  NIM {item.foundBy?.nim ?? '-'}</Text>
          <Text style={styles.cardDate}>{format(item.createdAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Fixed top section — tidak terpengaruh scroll */}
      <View style={styles.topSection}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Halo, {profile?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.headerTitle}>Barang Temuan</Text>

          {/* Unified Search + Filter */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Cari barang, lokasi, penemu..."
              placeholderTextColor={APP_COLORS.textLight}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={styles.clearBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Status Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.statusFilterRow}
            contentContainerStyle={{ gap: 8 }}>
            {([['', 'Semua'], ['available', 'Tersedia'], ['claimed', 'Diklaim'], ['completed', 'Selesai']] as [string, string][]).map(
              ([val, label]) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.filterChip, selectedStatus === val && styles.filterChipActive]}
                  onPress={() => setSelectedStatus(val as ItemStatus | '')}>
                  <Text
                    style={[styles.filterChipText, selectedStatus === val && styles.filterChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </ScrollView>
        </View>

        {/* Category Filter */}
        <View style={styles.categoryRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center', paddingVertical: 10 }}>
            <TouchableOpacity
              style={[styles.categoryChip, selectedCategory === '' && styles.categoryChipActive]}
              onPress={() => setSelectedCategory('')}>
              <Text style={[styles.categoryChipText, selectedCategory === '' && styles.categoryChipTextActive]}>
                🗂 Semua
              </Text>
            </TouchableOpacity>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}>
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === cat.id && styles.categoryChipTextActive,
                  ]}>
                  {cat.emoji} {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Items List — flex:1 agar tidak bisa naik ke atas */}
      <View style={styles.listSection}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={APP_COLORS.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>Tidak ada barang ditemukan</Text>
            <Text style={styles.emptySubtext}>Coba ubah filter pencarian</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            renderItem={renderItem}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.background },
  topSection: { flexShrink: 0 },
  listSection: { flex: 1 },
  header: { backgroundColor: APP_COLORS.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16 },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 14 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: APP_COLORS.text },
  clearBtn: { fontSize: 14, color: APP_COLORS.textMuted, paddingHorizontal: 4 },
  statusFilterRow: { marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterChipActive: { backgroundColor: '#fff' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  filterChipTextActive: { color: APP_COLORS.primary },
  categoryRow: { height: 52, marginVertical: 6, flexShrink: 0 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: APP_COLORS.border,
  },
  categoryChipActive: { backgroundColor: APP_COLORS.primaryLight, borderColor: APP_COLORS.primary },
  categoryChipText: { fontSize: 12, fontWeight: '600', color: APP_COLORS.textMuted },
  categoryChipTextActive: { color: APP_COLORS.primary },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImage: { width: '100%', height: 160 },
  cardImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: APP_COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryEmoji: { fontSize: 40 },
  cardContent: { padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: APP_COLORS.text, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardCategory: { fontSize: 12, color: APP_COLORS.textMuted, marginBottom: 4 },
  cardLocation: { fontSize: 12, color: APP_COLORS.textMuted, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardFinder: { fontSize: 11, color: APP_COLORS.primary, fontWeight: '600' },
  cardDate: { fontSize: 11, color: APP_COLORS.textLight },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: APP_COLORS.text, marginBottom: 4 },
  emptySubtext: { fontSize: 14, color: APP_COLORS.textMuted },
});
