import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { db } from '@/lib/firebase';
import { Item, CATEGORIES, APP_COLORS, ItemStatus } from '@/lib/types';
import { format } from '@/lib/dateUtils';

type Filter = ItemStatus | '';

export default function AdminItemsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [filtered, setFiltered] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Filter>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Item)));
      setLoading(false);
    });
    return unsub;
  }, []);

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

  const handleDelete = (item: Item) => {
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
  };

  const renderItem = ({ item }: { item: Item }) => {
    const catEmoji = CATEGORIES.find((c) => c.id === item.category)?.emoji ?? '📦';
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => router.push(`/(admin)/item/${item.id}`)}>
          {item.images?.length > 0 ? (
            <Image source={{ uri: item.images[0] }} style={styles.cardImage} contentFit="cover" />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <Text style={{ fontSize: 28 }}>{catEmoji}</Text>
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardMeta}>{catEmoji} {item.category}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>📍 {item.location?.address || '-'}</Text>
            <Text style={styles.cardMeta}>👤 Penemu: {item.foundBy?.name} ({item.foundBy?.nim})</Text>
            {item.claimedBy && (
              <Text style={styles.cardMeta}>🔖 Diklaim: {item.claimedBy.name} ({item.claimedBy.nim})</Text>
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
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
          <Text style={styles.deleteBtnText}>🗑</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kelola Barang</Text>
        <Text style={styles.headerSub}>{filtered.length} barang ditemukan</Text>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama, penemu, lokasi..."
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
          contentContainerStyle={{ gap: 8 }}>
          {([['', 'Semua'], ['available', 'Tersedia'], ['claimed', 'Diklaim'], ['completed', 'Selesai']] as [Filter, string][]).map(
            ([val, lbl]) => (
              <TouchableOpacity
                key={val}
                style={[styles.chip, statusFilter === val && styles.chipActive]}
                onPress={() => setStatusFilter(val)}>
                <Text style={[styles.chipText, statusFilter === val && styles.chipTextActive]}>
                  {lbl}
                </Text>
              </TouchableOpacity>
            )
          )}
        </ScrollView>
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <TouchableOpacity
          style={[styles.catChip, categoryFilter === '' && styles.catChipActive]}
          onPress={() => setCategoryFilter('')}>
          <Text style={[styles.catChipText, categoryFilter === '' && styles.catChipTextActive]}>
            🗂 Semua
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.catChip, categoryFilter === cat.id && styles.catChipActive]}
            onPress={() => setCategoryFilter(categoryFilter === cat.id ? '' : cat.id)}>
            <Text style={[styles.catChipText, categoryFilter === cat.id && styles.catChipTextActive]}>
              {cat.emoji} {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={APP_COLORS.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Tidak ada barang</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function statusLabel(s: string) {
  return s === 'available' ? 'Tersedia' : s === 'claimed' ? 'Diklaim' : 'Selesai';
}
function statusColor(s: string) {
  return s === 'available' ? APP_COLORS.success : s === 'claimed' ? APP_COLORS.warning : APP_COLORS.textMuted;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.background },
  header: { backgroundColor: APP_COLORS.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: APP_COLORS.text },
  clearBtn: { fontSize: 14, color: APP_COLORS.textMuted, paddingHorizontal: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  chipActive: { backgroundColor: '#fff' },
  chipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  chipTextActive: { color: APP_COLORS.primary },
  catRow: { maxHeight: 50, marginVertical: 10 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: APP_COLORS.border, alignSelf: 'flex-start' },
  catChipActive: { backgroundColor: APP_COLORS.primaryLight, borderColor: APP_COLORS.primary },
  catChipText: { fontSize: 12, fontWeight: '600', color: APP_COLORS.textMuted },
  catChipTextActive: { color: APP_COLORS.primary },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, flexDirection: 'row' },
  cardMain: { flex: 1, flexDirection: 'row' },
  cardImage: { width: 90, height: 'auto' },
  cardImagePlaceholder: { width: 90, backgroundColor: APP_COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, padding: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: APP_COLORS.text, marginBottom: 4 },
  cardMeta: { fontSize: 11, color: APP_COLORS.textMuted, marginBottom: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardDate: { fontSize: 10, color: APP_COLORS.textLight },
  deleteBtn: { padding: 14, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: APP_COLORS.border },
  deleteBtnText: { fontSize: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: APP_COLORS.textMuted },
});
