/**
 * app/(user)/(tabs)/index.tsx — Halaman Utama (Feed Barang Temuan)
 * Menampilkan daftar barang temuan yang sudah disetujui admin (status != 'pending').
 * Fitur: real-time sync Firestore, pagination lazy-load, filter waktu, dan
 * modal pencarian dengan filter kategori + waktu secara bersamaan.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/lib/firebase';
import { Item, CATEGORIES, APP_COLORS, ItemStatus } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { format } from '@/lib/dateUtils';

/** Label bahasa Indonesia untuk setiap status item */
const STATUS_LABELS: Record<ItemStatus, string> = {
  pending: 'Menunggu',
  available: 'Tersedia',
  claim_pending: 'Klaim Ditinjau',
  claimed: 'Diklaim',
  completed: 'Selesai',
};

const CATEGORY_COLORS: Record<string, string> = {
  'HP/Gadget': '#6366f1',
  'Kartu/ID': '#10b981',
  'Kunci': '#f59e0b',
  'Tas/Dompet': '#ef4444',
  'Buku/ATK': '#3b82f6',
  'Pakaian': '#8b5cf6',
  'Lainnya': '#f97316',
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  pending: APP_COLORS.warning,
  available: APP_COLORS.statusAvailable,
  claim_pending: APP_COLORS.primary,
  claimed: APP_COLORS.statusClaimed,
  completed: APP_COLORS.statusCompleted,
};

// Jumlah item per halaman; pageSize ditambah PAGE_SIZE setiap kali onEndReached dipicu
const PAGE_SIZE = 10;

/** Opsi filter waktu: [nilai internal, label tampilan] */
const TIME_FILTERS: [string, string][] = [
  ['', 'Semua'],
  ['today', 'Hari Ini'],
  ['week', 'Minggu Ini'],
  ['month', 'Bulan Ini'],
];

/**
 * Menyaring daftar item berdasarkan filter waktu yang dipilih user.
 * Perbandingan dilakukan berdasarkan field createdAt setiap item.
 *
 * @param items - Daftar item yang akan difilter
 * @param time  - Nilai filter: '' (semua), 'today', 'week', atau 'month'
 */
function applyTimeFilter(items: Item[], time: string): Item[] {
  if (!time) return items;
  const now = new Date();
  return items.filter((i) => {
    const ts = i.createdAt;
    if (!ts) return false;
    const date: Date = ts.toDate ? ts.toDate() : new Date(ts as any);
    if (time === 'today') return date.toDateString() === now.toDateString();
    if (time === 'week') {
      const ago = new Date(now);
      ago.setDate(now.getDate() - 7);
      return date >= ago;
    }
    if (time === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    return true;
  });
}

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { top, bottom } = useSafeAreaInsets();
  const [items, setItems] = useState<Item[]>([]);
  const [filtered, setFiltered] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);
  const [selectedTime, setSelectedTime] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilterTime, setSearchFilterTime] = useState('');
  const [searchFilterCategory, setSearchFilterCategory] = useState('');

  // Listener real-time Firestore; di-refresh saat pageSize bertambah (lazy load)
  // Item berstatus 'pending' disembunyikan dari user — hanya admin yang bisa melihatnya
  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'), limit(pageSize));
    return onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Item))
        .filter((i) => i.status !== 'pending');
      setItems(data);
      setHasMore(snap.docs.length === pageSize);
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    });
  }, [pageSize]);

  useEffect(() => {
    setFiltered(applyTimeFilter(items, selectedTime));
  }, [items, selectedTime]);

  // Hasil pencarian dihitung ulang setiap kali query, filter waktu, atau kategori berubah
  const searchResults = useMemo(() => {
    let result = [...items];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.location?.address?.toLowerCase().includes(q) ||
          i.foundBy?.name?.toLowerCase().includes(q)
      );
    }
    result = applyTimeFilter(result, searchFilterTime);
    if (searchFilterCategory) result = result.filter((i) => i.category === searchFilterCategory);
    return result;
  }, [items, searchQuery, searchFilterTime, searchFilterCategory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPageSize(PAGE_SIZE);
  }, []);

  const onEndReached = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setPageSize((p) => p + PAGE_SIZE);
  }, [hasMore, loadingMore]);

  const openSearch = () => {
    setSearchQuery('');
    setSearchFilterTime('');
    setSearchFilterCategory('');
    setSearchActive(true);
  };

  const closeSearch = () => {
    setSearchActive(false);
    setSearchQuery('');
  };

  const renderCard = (item: Item, onPress: () => void) => (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      {item.images?.length > 0 && typeof item.images[0] === 'string' && item.images[0].startsWith('http') ? (
        <Image source={{ uri: item.images[0] }} style={styles.cardImage} contentFit="cover" />
      ) : (
        <View style={[styles.cardImagePlaceholder, { backgroundColor: CATEGORY_COLORS[item.category] ?? APP_COLORS.primaryLight }]}>
          <Ionicons
            name={(CATEGORIES.find((c) => c.id === item.category)?.icon ?? 'cube-outline') as any}
            size={40}
            color="#fff"
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
        <View style={styles.cardFooter}>
          <View style={styles.cardFinderRow}>
            <Ionicons name="person-outline" size={11} color={APP_COLORS.primary} style={{ marginTop: 2 }} />
            <View>
              <Text style={styles.cardFinder} numberOfLines={1}>{item.foundBy?.name ?? 'Anonim'}</Text>
              <Text style={styles.cardFinderNim}>NIM {item.foundBy?.nim ?? '-'}</Text>
            </View>
          </View>
          <Text style={styles.cardDate}>{format(item.createdAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: Item }) =>
    renderCard(item, () => router.push(`/(user)/item/${item.id}`));

  const renderSearchItem = ({ item }: { item: Item }) =>
    renderCard(item, () => { closeSearch(); router.push(`/(user)/item/${item.id}`); });

  const showSearchHint = !searchQuery.trim() && !searchFilterTime && !searchFilterCategory;

  return (
    <View style={styles.container}>
      {/* Fixed top section */}
      <View style={styles.topSection}>
        <View style={[styles.header, { paddingTop: top + 8 }]}>
          <Text style={styles.greeting}>Halo, {profile?.name?.split(' ')[0]}</Text>
          <Text style={styles.headerTitle}>Barang Temuan</Text>
          <Text style={styles.itemCount}>
            {items.length} terdaftar  ·  {items.filter(i => i.status === 'available').length} tersedia
          </Text>

          {/* Tappable search bar */}
          <TouchableOpacity style={styles.searchBar} onPress={openSearch} activeOpacity={0.8}>
            <Ionicons name="search-outline" size={16} color={APP_COLORS.textMuted} style={{ marginRight: 8 }} />
            <Text style={styles.searchBarPlaceholder}>Cari barang, lokasi, penemu...</Text>
            <Ionicons name="options-outline" size={16} color={APP_COLORS.textMuted} />
          </TouchableOpacity>

          {/* Time filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.timeChipRow}
            contentContainerStyle={{ gap: 8 }}>
            {TIME_FILTERS.map(([val, label]) => (
              <TouchableOpacity
                key={val}
                style={[styles.timeChip, selectedTime === val && styles.timeChipActive]}
                onPress={() => setSelectedTime(val)}>
                <Text style={[styles.timeChipText, selectedTime === val && styles.timeChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Items List */}
      <View style={styles.listSection}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={APP_COLORS.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="cube-outline" size={48} color={APP_COLORS.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>Belum ada barang</Text>
            <Text style={styles.emptySubtext}>Belum ada barang temuan yang terdaftar</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            renderItem={renderItem}
            keyExtractor={(i) => i.id}
            contentContainerStyle={[styles.list, { paddingBottom: 60 + bottom + 16 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.4}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={APP_COLORS.primary} style={{ marginVertical: 12 }} /> : null
            }
          />
        )}
      </View>

      {/* Search Modal */}
      <Modal visible={searchActive} animationType="slide" onRequestClose={closeSearch}>
        <View style={[styles.searchModal, { paddingTop: top }]}>
          {/* Header */}
          <View style={styles.searchModalHeader}>
            <TouchableOpacity onPress={closeSearch} style={styles.searchBackBtn}>
              <Ionicons name="arrow-back" size={22} color={APP_COLORS.text} />
            </TouchableOpacity>
            <View style={styles.searchModalInputWrap}>
              <Ionicons name="search-outline" size={16} color={APP_COLORS.primary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchModalInput}
                placeholder="Cari barang, lokasi, penemu..."
                placeholderTextColor={APP_COLORS.textLight}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={APP_COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Filters */}
          <View style={styles.searchFiltersSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.searchFilterRow}
              keyboardShouldPersistTaps="always">
              {TIME_FILTERS.map(([val, label]) => (
                <TouchableOpacity
                  key={`t-${val}`}
                  style={[styles.filterChip, searchFilterTime === val && styles.filterChipActive]}
                  onPress={() => setSearchFilterTime(val)}>
                  <Text style={[styles.filterChipText, searchFilterTime === val && styles.filterChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
              <View style={styles.filterDivider} />
              <TouchableOpacity
                style={[styles.filterChip, searchFilterCategory === '' && styles.filterChipActive]}
                onPress={() => setSearchFilterCategory('')}>
                <Text style={[styles.filterChipText, searchFilterCategory === '' && styles.filterChipTextActive]}>
                  Semua Kategori
                </Text>
              </TouchableOpacity>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={`c-${cat.id}`}
                  style={[styles.filterChip, searchFilterCategory === cat.id && styles.filterChipActive]}
                  onPress={() => setSearchFilterCategory(searchFilterCategory === cat.id ? '' : cat.id)}>
                  <Ionicons
                    name={cat.icon as any}
                    size={12}
                    color={searchFilterCategory === cat.id ? APP_COLORS.primary : APP_COLORS.textMuted}
                  />
                  <Text style={[styles.filterChipText, searchFilterCategory === cat.id && styles.filterChipTextActive]}>
                    {' '}{cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {!showSearchHint && (
              <Text style={styles.searchResultCount}>{searchResults.length} hasil ditemukan</Text>
            )}
          </View>

          {/* Results */}
          {showSearchHint ? (
            <View style={styles.searchEmpty}>
              <Ionicons name="search-outline" size={52} color={APP_COLORS.textMuted} style={{ marginBottom: 14 }} />
              <Text style={styles.searchEmptyTitle}>Cari barang temuan</Text>
              <Text style={styles.searchEmptySub}>Ketik nama barang, lokasi, atau nama penemu</Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.searchEmpty}>
              <Ionicons name="file-tray-outline" size={52} color={APP_COLORS.textMuted} style={{ marginBottom: 14 }} />
              <Text style={styles.searchEmptyTitle}>Tidak ditemukan</Text>
              <Text style={styles.searchEmptySub}>Coba kata kunci lain atau ubah filter</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={renderSearchItem}
              keyExtractor={(i) => i.id}
              contentContainerStyle={[styles.list, { paddingBottom: bottom + 24 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.background },
  topSection: { flexShrink: 0 },
  listSection: { flex: 1 },
  header: {
    backgroundColor: APP_COLORS.primary,
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  itemCount: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: -4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchBarPlaceholder: { fontSize: 14, color: APP_COLORS.textLight, flex: 1 },
  timeChipRow: { flexGrow: 0 },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  timeChipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  timeChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  timeChipTextActive: { color: APP_COLORS.primary },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImage: { width: '100%', height: 160 },
  cardImagePlaceholder: { width: '100%', height: 120, justifyContent: 'center', alignItems: 'center' },
  cardContent: { padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: APP_COLORS.text, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardCategoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardCategory: { fontSize: 12, color: APP_COLORS.textMuted },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardFinderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, flex: 1 },
  cardFinder: { fontSize: 11, color: APP_COLORS.primary, fontWeight: '600' },
  cardFinderNim: { fontSize: 10, color: APP_COLORS.textMuted, marginTop: 1 },
  cardDate: { fontSize: 11, color: APP_COLORS.textLight, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, fontWeight: '600', color: APP_COLORS.text, marginBottom: 4 },
  emptySubtext: { fontSize: 14, color: APP_COLORS.textMuted },
  searchModal: { flex: 1, backgroundColor: APP_COLORS.background },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.border,
  },
  searchBackBtn: { padding: 6 },
  searchModalInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: APP_COLORS.primary,
  },
  searchModalInput: { flex: 1, fontSize: 14, color: APP_COLORS.text },
  searchFiltersSection: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.border,
    paddingBottom: 8,
  },
  searchFilterRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
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
  filterDivider: { width: 1, height: 20, backgroundColor: APP_COLORS.border, marginHorizontal: 4 },
  searchResultCount: { fontSize: 12, color: APP_COLORS.textMuted, paddingHorizontal: 16, paddingTop: 6 },
  searchEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  searchEmptyTitle: { fontSize: 16, fontWeight: '600', color: APP_COLORS.text, marginBottom: 6 },
  searchEmptySub: { fontSize: 14, color: APP_COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
});
