import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
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
  const [filtered, setFiltered] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Filter>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilter = !!statusFilter || !!categoryFilter;

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

  const onEndReached = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setPageSize((p) => p + PAGE_SIZE);
  }, [hasMore, loadingMore]);

  useEffect(() => {
    let r = [...items];
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.foundBy?.name?.toLowerCase().includes(q) ||
          i.claimedBy?.name?.toLowerCase().includes(q) ||
          i.location?.address?.toLowerCase().includes(q)
      );
    }
    if (statusFilter) r = r.filter((i) => i.status === statusFilter);
    if (categoryFilter) r = r.filter((i) => i.category === categoryFilter);
    setFiltered(r);
  }, [items, search, statusFilter, categoryFilter]);

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

  const renderItem = useCallback(({ item }: { item: Item }) => {
    const catIcon = (CATEGORIES.find((c) => c.id === item.category)?.icon ?? 'cube-outline') as any;
    const hasImage =
      Array.isArray(item.images) &&
      item.images.length > 0 &&
      typeof item.images[0] === 'string' &&
      item.images[0].startsWith('http');

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardMain}
          activeOpacity={0.7}
          onPress={() => router.push(`/(admin)/item/${item.id}`)}>
          {hasImage ? (
            <Image
              source={{ uri: item.images[0] }}
              style={styles.cardImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <Ionicons name={catIcon} size={24} color={APP_COLORS.primary} />
              <Text style={styles.placeholderText}>Tidak ada{'\n'}foto</Text>
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardMeta}>Kategori: {item.category}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              Lokasi: {item.location?.address || '-'}
            </Text>
            <Text style={styles.cardMeta}>
              Penemu: {item.foundBy?.name || '-'} ({item.foundBy?.nim || '-'})
            </Text>
            {item.claimedBy && (
              <Text style={styles.cardMeta}>
                Diklaim: {item.claimedBy.name} ({item.claimedBy.nim})
              </Text>
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

  const ListEmpty = useCallback(() => (
    <View style={styles.center}>
      {loading ? (
        <ActivityIndicator size="large" color={APP_COLORS.primary} />
      ) : (
        <Text style={styles.emptyText}>Tidak ada barang</Text>
      )}
    </View>
  ), [loading]);

  return (
    <View style={styles.container}>
      {/* Fixed header — tidak bergerak saat list update */}
      <View style={[styles.header, { paddingTop: top + 8 }]}>
        <Text style={styles.headerTitle}>Kelola Barang</Text>
        <Text style={styles.headerSub}>{filtered.length} barang ditemukan</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={APP_COLORS.textMuted} style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari nama, penemu, lokasi..."
              placeholderTextColor={APP_COLORS.textLight}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
            {STATUS_FILTERS.map(([val, lbl]) => (
              <TouchableOpacity
                key={val}
                style={[styles.chip, statusFilter === val && styles.chipActive]}
                onPress={() => setStatusFilter(val)}>
                <Text style={[styles.chipText, statusFilter === val && styles.chipTextActive]}>
                  {lbl}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.filterLabel}>Kategori</Text>
          <View style={styles.filterChipRow}>
            <TouchableOpacity
              style={[styles.catChip, categoryFilter === '' && styles.catChipActive]}
              onPress={() => setCategoryFilter('')}>
              <Text style={[styles.catChipText, categoryFilter === '' && styles.catChipTextActive]}>
                Semua
              </Text>
            </TouchableOpacity>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catChip, categoryFilter === cat.id && styles.catChipActive]}
                onPress={() => setCategoryFilter(categoryFilter === cat.id ? '' : cat.id)}>
                <Ionicons name={cat.icon as any} size={12} color={categoryFilter === cat.id ? APP_COLORS.primary : APP_COLORS.textMuted} />
                <Text style={[styles.catChipText, categoryFilter === cat.id && styles.catChipTextActive]}>
                  {' '}{cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* FlatList selalu di-render — ListEmptyComponent untuk loading/kosong */}
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: 60 + bottom + 16 }, filtered.length === 0 && { flex: 1 }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={APP_COLORS.primary} style={{ marginVertical: 12 }} /> : null
        }
      />
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
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1.5,
    borderColor: APP_COLORS.border,
  },
  chipActive: { backgroundColor: APP_COLORS.primaryLight, borderColor: APP_COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: APP_COLORS.textMuted },
  chipTextActive: { color: APP_COLORS.primary },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1.5,
    borderColor: APP_COLORS.border,
  },
  catChipActive: { backgroundColor: APP_COLORS.primaryLight, borderColor: APP_COLORS.primary },
  catChipText: { fontSize: 12, fontWeight: '600', color: APP_COLORS.textMuted },
  catChipTextActive: { color: APP_COLORS.primary },
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
  placeholderText: {
    fontSize: 9,
    color: APP_COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 13,
  },
  cardInfo: { flex: 1, padding: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: APP_COLORS.text, marginBottom: 4 },
  cardMeta: { fontSize: 11, color: APP_COLORS.textMuted, marginBottom: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
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
});
