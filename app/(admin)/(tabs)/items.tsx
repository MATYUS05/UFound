/**
 * app/(admin)/(tabs)/items.tsx — Halaman Kelola Barang (Admin)
 * Menampilkan semua barang dari semua status dengan filter status, pencarian teks,
 * dan filter kategori. Admin dapat menghapus barang dari sini kecuali yang sudah 'completed'.
 * Data di-sort berdasarkan updatedAt agar perubahan terbaru muncul paling atas.
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
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, limit } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { db } from '@/lib/firebase';
import { Item, CATEGORIES, APP_COLORS, ItemStatus } from '@/lib/types';
import { format } from '@/lib/dateUtils';

type Filter = ItemStatus | '';

const STATUS_FILTERS: [Filter, string][] = [
  ['', 'Semua'],
  ['pending', 'Menunggu'],
  ['available', 'Tersedia'],
  ['claim_pending', 'Klaim Ditinjau'],
  ['claimed', 'Diklaim'],
  ['completed', 'Selesai'],
];

const PAGE_SIZE = 10;

export default function AdminItemsScreen() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Filter>('');
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilterStatus, setSearchFilterStatus] = useState<Filter>('');
  const [searchFilterCategory, setSearchFilterCategory] = useState('');

  // Firestore hanya bisa orderBy satu field; sort ulang di klien berdasarkan updatedAt
  // agar barang yang baru diproses admin naik ke atas meski createdAt-nya lama
  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'), limit(pageSize));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Item));
      data.sort((a, b) => {
        const ta = ((a as any).updatedAt ?? a.createdAt)?.toMillis?.() ?? 0;
        const tb = ((b as any).updatedAt ?? b.createdAt)?.toMillis?.() ?? 0;
        return tb - ta;
      });
      setItems(data);
      setHasMore(snap.docs.length === pageSize);
      setLoading(false);
      setLoadingMore(false);
    });
  }, [pageSize]);

  const filtered = useMemo(() => {
    if (!statusFilter) return items;
    return items.filter((i) => i.status === statusFilter);
  }, [items, statusFilter]);

  const searchResults = useMemo(() => {
    let r = [...items];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.foundBy?.name?.toLowerCase().includes(q) ||
          i.claimedBy?.name?.toLowerCase().includes(q) ||
          i.location?.address?.toLowerCase().includes(q)
      );
    }
    if (searchFilterStatus) r = r.filter((i) => i.status === searchFilterStatus);
    if (searchFilterCategory) r = r.filter((i) => i.category === searchFilterCategory);
    return r;
  }, [items, searchQuery, searchFilterStatus, searchFilterCategory]);

  const onEndReached = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setPageSize((p) => p + PAGE_SIZE);
  }, [hasMore, loadingMore]);

  const openSearch = () => {
    setSearchQuery('');
    setSearchFilterStatus('');
    setSearchFilterCategory('');
    setSearchActive(true);
  };

  const closeSearch = () => {
    setSearchActive(false);
    setSearchQuery('');
  };

  /** Menghapus dokumen item dari Firestore setelah konfirmasi alert */
  const handleDelete = useCallback((item: Item) => {
    Alert.alert('Hapus Barang', `Yakin hapus "${item.title}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'items', item.id));
          } catch {
            Alert.alert('Error', 'Gagal menghapus barang');
          }
        },
      },
    ]);
  }, []);

  const renderCard = useCallback((item: Item, onPress: () => void) => {
    const catIcon = (CATEGORIES.find((c) => c.id === item.category)?.icon ?? 'cube-outline') as any;
    const hasImage =
      Array.isArray(item.images) &&
      item.images.length > 0 &&
      typeof item.images[0] === 'string' &&
      item.images[0].startsWith('http');

    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardMain} activeOpacity={0.7} onPress={onPress}>
          {hasImage ? (
            <Image source={{ uri: item.images[0] }} style={styles.cardImage} contentFit="cover" transition={200} />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <Ionicons name={catIcon} size={24} color={APP_COLORS.primary} />
              <Text style={styles.placeholderText}>Tidak ada{'\n'}foto</Text>
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardMeta}>Kategori: {item.category}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>Lokasi: {item.location?.address || '-'}</Text>
            <Text style={styles.cardMeta}>Penemu: {item.foundBy?.name || '-'} ({item.foundBy?.nim || '-'})</Text>
            {item.claimedBy && (
              <Text style={styles.cardMeta}>Diklaim: {item.claimedBy.name} ({item.claimedBy.nim})</Text>
            )}
            <View style={styles.cardFooter}>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '22' }]}>
                <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                  {statusLabel(item.status)}
                </Text>
              </View>
              <Text style={styles.cardDate}>{format(item.createdAt)}</Text>
            </View>
          </View>
        </TouchableOpacity>
        {item.status !== 'completed' && (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
            <Text style={styles.deleteBtnText}>Hapus</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [handleDelete]);

  const renderItem = useCallback(({ item }: { item: Item }) =>
    renderCard(item, () => router.push(`/(admin)/item/${item.id}`)),
  [renderCard, router]);

  const renderSearchItem = useCallback(({ item }: { item: Item }) =>
    renderCard(item, () => { closeSearch(); router.push(`/(admin)/item/${item.id}`); }),
  [renderCard]);

  const showSearchHint = !searchQuery.trim() && !searchFilterStatus && !searchFilterCategory;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: top + 8 }]}>
        <Text style={styles.headerTitle}>Kelola Barang</Text>
        <Text style={styles.headerSub}>{filtered.length} barang</Text>

        {/* Tappable search bar */}
        <TouchableOpacity style={styles.searchBar} onPress={openSearch} activeOpacity={0.8}>
          <Ionicons name="search-outline" size={16} color={APP_COLORS.textMuted} style={{ marginRight: 8 }} />
          <Text style={styles.searchBarPlaceholder}>Cari nama, penemu, lokasi...</Text>
          <Ionicons name="options-outline" size={16} color={APP_COLORS.textMuted} />
        </TouchableOpacity>

        {/* Status filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statusChipRow}
          contentContainerStyle={{ gap: 8 }}>
          {STATUS_FILTERS.map(([val, lbl]) => (
            <TouchableOpacity
              key={val}
              style={[styles.statusChip, statusFilter === val && styles.statusChipActive]}
              onPress={() => setStatusFilter(val)}>
              <Text style={[styles.statusChipText, statusFilter === val && styles.statusChipTextActive]}>
                {lbl}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={APP_COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: 60 + bottom + 16 },
            filtered.length === 0 && { flex: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Tidak ada barang</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={APP_COLORS.primary} style={{ marginVertical: 12 }} /> : null
          }
        />
      )}

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
                placeholder="Cari nama, penemu, lokasi..."
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
              {STATUS_FILTERS.map(([val, lbl]) => (
                <TouchableOpacity
                  key={`s-${val}`}
                  style={[styles.filterChip, searchFilterStatus === val && styles.filterChipActive]}
                  onPress={() => setSearchFilterStatus(val)}>
                  <Text style={[styles.filterChipText, searchFilterStatus === val && styles.filterChipTextActive]}>
                    {lbl}
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
              <Text style={styles.searchEmptyTitle}>Cari barang</Text>
              <Text style={styles.searchEmptySub}>Ketik nama barang, penemu, atau lokasi</Text>
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

function statusLabel(s: string) {
  if (s === 'pending') return 'Menunggu';
  if (s === 'available') return 'Tersedia';
  if (s === 'claim_pending') return 'Klaim Ditinjau';
  if (s === 'claimed') return 'Diklaim';
  return 'Selesai';
}
function statusColor(s: string) {
  if (s === 'pending') return APP_COLORS.warning;
  if (s === 'available') return APP_COLORS.success;
  if (s === 'claim_pending') return APP_COLORS.primary;
  if (s === 'claimed') return APP_COLORS.primary;
  return APP_COLORS.textMuted;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.background },
  header: {
    backgroundColor: APP_COLORS.primary,
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: -4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchBarPlaceholder: { fontSize: 14, color: APP_COLORS.textLight, flex: 1 },
  statusChipRow: { flexGrow: 0 },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  statusChipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  statusChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  statusChipTextActive: { color: APP_COLORS.primary },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    flexDirection: 'row',
    minHeight: 90,
  },
  cardMain: { flex: 1, flexDirection: 'row' },
  cardImage: { width: 90, height: '100%' },
  cardImagePlaceholder: {
    width: 90,
    backgroundColor: APP_COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  placeholderText: { fontSize: 9, color: APP_COLORS.textMuted, textAlign: 'center', lineHeight: 13 },
  cardInfo: { flex: 1, padding: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: APP_COLORS.text, marginBottom: 4 },
  cardMeta: { fontSize: 11, color: APP_COLORS.textMuted, marginBottom: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardDate: { fontSize: 10, color: APP_COLORS.textLight },
  deleteBtn: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: APP_COLORS.border,
  },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: APP_COLORS.error },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: APP_COLORS.textMuted },
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
