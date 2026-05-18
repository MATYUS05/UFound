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
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, orderBy, onSnapshot, QueryConstraint } from 'firebase/firestore';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
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
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilter = !!selectedStatus || !!selectedCategory;

  useEffect(() => {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    const q = query(collection(db, 'items'), ...constraints);
    return onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Item))
        .filter((i) => i.status !== 'pending');
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
      {item.images?.length > 0 && typeof item.images[0] === 'string' && item.images[0].startsWith('http') ? (
        <Image source={{ uri: item.images[0] }} style={styles.cardImage} contentFit="cover" />
      ) : (
        <View style={styles.cardImagePlaceholder}>
          <Ionicons
            name={(CATEGORIES.find((c) => c.id === item.category)?.icon ?? 'cube-outline') as any}
            size={40}
            color={APP_COLORS.primary}
          />
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
        <View style={styles.cardCategoryRow}>
          <Ionicons
            name={(CATEGORIES.find((c) => c.id === item.category)?.icon ?? 'cube-outline') as any}
            size={12}
            color={APP_COLORS.textMuted}
          />
          <Text style={styles.cardCategory}> {item.category}</Text>
        </View>
        <View style={styles.cardLocationRow}>
          <Ionicons name="location-outline" size={12} color={APP_COLORS.textMuted} />
          <Text style={styles.cardLocation} numberOfLines={1}>
            {item.location?.address || 'Lokasi tidak tersedia'}
          </Text>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.cardFinderRow}>
            <Ionicons name="person-outline" size={11} color={APP_COLORS.primary} />
            <Text style={styles.cardFinder} numberOfLines={1}> {item.foundBy?.name ?? 'Anonim'}  ·  NIM {item.foundBy?.nim ?? '-'}</Text>
          </View>
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
          <Text style={styles.greeting}>Halo, {profile?.name?.split(' ')[0]}</Text>
          <Text style={styles.headerTitle}>Barang Temuan</Text>

          {/* Search + Filter Toggle */}
          <View style={styles.searchRow}>
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={16} color={APP_COLORS.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari barang, lokasi, penemu..."
                placeholderTextColor={APP_COLORS.textLight}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close" size={16} color={APP_COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.filterToggleBtn, (showFilters || hasActiveFilter) && styles.filterToggleBtnActive]}
              onPress={() => setShowFilters(!showFilters)}>
              <Ionicons
                name="options-outline"
                size={18}
                color={(showFilters || hasActiveFilter) ? APP_COLORS.primary : '#fff'}
              />
              {hasActiveFilter && <View style={styles.filterDot} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Collapsible Filters */}
        {showFilters && (
          <View style={styles.filtersPanel}>
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.filterChipRow}>
              {([['', 'Semua'], ['available', 'Tersedia'], ['claimed', 'Diklaim'], ['completed', 'Selesai']] as [string, string][]).map(
                ([val, label]) => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.filterChip, selectedStatus === val && styles.filterChipActive]}
                    onPress={() => setSelectedStatus(val as ItemStatus | '')}>
                    <Text style={[styles.filterChipText, selectedStatus === val && styles.filterChipTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
            <Text style={styles.filterLabel}>Kategori</Text>
            <View style={styles.filterChipRow}>
              <TouchableOpacity
                style={[styles.filterChip, selectedCategory === '' && styles.filterChipActive]}
                onPress={() => setSelectedCategory('')}>
                <Text style={[styles.filterChipText, selectedCategory === '' && styles.filterChipTextActive]}>
                  Semua
                </Text>
              </TouchableOpacity>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.filterChip, selectedCategory === cat.id && styles.filterChipActive]}
                  onPress={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}>
                  <Ionicons
                    name={cat.icon as any}
                    size={12}
                    color={selectedCategory === cat.id ? APP_COLORS.primary : APP_COLORS.textMuted}
                  />
                  <Text style={[styles.filterChipText, selectedCategory === cat.id && styles.filterChipTextActive]}>
                    {' '}{cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Items List — flex:1 agar tidak bisa naik ke atas */}
      <View style={styles.listSection}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={APP_COLORS.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="search-outline" size={48} color={APP_COLORS.textMuted} style={{ marginBottom: 12 }} />
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
  header: { backgroundColor: APP_COLORS.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, gap: 10 },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: APP_COLORS.text },
  filterToggleBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterToggleBtnActive: { backgroundColor: '#fff' },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: APP_COLORS.warning,
  },
  filtersPanel: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.border,
  },
  filterLabel: { fontSize: 11, fontWeight: '700', color: APP_COLORS.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  filterChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1.5,
    borderColor: APP_COLORS.border,
  },
  filterChipActive: { backgroundColor: APP_COLORS.primaryLight, borderColor: APP_COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: APP_COLORS.textMuted },
  filterChipTextActive: { color: APP_COLORS.primary },
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
  cardContent: { padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: APP_COLORS.text, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardCategoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardCategory: { fontSize: 12, color: APP_COLORS.textMuted },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  cardLocation: { fontSize: 12, color: APP_COLORS.textMuted, flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardFinderRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  cardFinder: { fontSize: 11, color: APP_COLORS.primary, fontWeight: '600' },
  cardDate: { fontSize: 11, color: APP_COLORS.textLight },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, fontWeight: '600', color: APP_COLORS.text, marginBottom: 4 },
  emptySubtext: { fontSize: 14, color: APP_COLORS.textMuted },
});
