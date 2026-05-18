import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Item, APP_COLORS, CATEGORIES } from '@/lib/types';
import { format } from '@/lib/dateUtils';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Item)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const stats = {
    total: items.length,
    available: items.filter((i) => i.status === 'available').length,
    claimed: items.filter((i) => i.status === 'claimed').length,
    completed: items.filter((i) => i.status === 'completed').length,
  };

  const recent = items.slice(0, 5);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerSub}>Selamat datang,</Text>
        <Text style={styles.headerTitle}>{profile?.name} 👑</Text>
        <Text style={styles.headerRole}>Administrator UFound</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Total Barang', value: stats.total, color: APP_COLORS.primary, emoji: '📦' },
            { label: 'Tersedia', value: stats.available, color: APP_COLORS.success, emoji: '✅' },
            { label: 'Diklaim', value: stats.claimed, color: APP_COLORS.warning, emoji: '🔖' },
            { label: 'Selesai', value: stats.completed, color: APP_COLORS.textMuted, emoji: '✔️' },
          ].map((stat) => (
            <View key={stat.label} style={[styles.statCard, { borderLeftColor: stat.color }]}>
              <Text style={styles.statEmoji}>{stat.emoji}</Text>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Category breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Barang Per Kategori</Text>
          {loading ? (
            <ActivityIndicator color={APP_COLORS.primary} />
          ) : (
            CATEGORIES.map((cat) => {
              const count = items.filter((i) => i.category === cat.id).length;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <View key={cat.id} style={styles.categoryRow}>
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  <View style={styles.catInfo}>
                    <View style={styles.catLabelRow}>
                      <Text style={styles.catLabel}>{cat.label}</Text>
                      <Text style={styles.catCount}>{count}</Text>
                    </View>
                    <View style={styles.progressBg}>
                      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: APP_COLORS.primary }]} />
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Recent Items */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Laporan Terbaru</Text>
            <TouchableOpacity onPress={() => router.push('/(admin)/(tabs)/items')}>
              <Text style={styles.seeAll}>Lihat Semua →</Text>
            </TouchableOpacity>
          </View>
          {recent.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.recentCard}
              onPress={() => router.push(`/(admin)/item/${item.id}`)}>
              <View style={styles.recentInfo}>
                <Text style={styles.recentTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.recentMeta}>
                  {CATEGORIES.find((c) => c.id === item.category)?.emoji} {item.category} • {format(item.createdAt)}
                </Text>
              </View>
              <View style={[styles.recentStatus, { backgroundColor: statusColor(item.status) + '22' }]}>
                <Text style={[styles.recentStatusText, { color: statusColor(item.status) }]}>
                  {statusLabel(item.status)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
  header: { backgroundColor: APP_COLORS.primary, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 2 },
  headerRole: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  content: { padding: 16, paddingBottom: 30 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statEmoji: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, color: APP_COLORS.textMuted, marginTop: 2 },
  section: { marginBottom: 20 },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: APP_COLORS.text, marginBottom: 12 },
  seeAll: { fontSize: 13, color: APP_COLORS.primary, fontWeight: '600' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  catEmoji: { fontSize: 18, width: 24 },
  catInfo: { flex: 1 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catLabel: { fontSize: 13, color: APP_COLORS.text, fontWeight: '500' },
  catCount: { fontSize: 13, color: APP_COLORS.textMuted, fontWeight: '600' },
  progressBg: { height: 6, backgroundColor: APP_COLORS.border, borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  recentInfo: { flex: 1 },
  recentTitle: { fontSize: 14, fontWeight: '600', color: APP_COLORS.text },
  recentMeta: { fontSize: 12, color: APP_COLORS.textMuted, marginTop: 2 },
  recentStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  recentStatusText: { fontSize: 11, fontWeight: '700' },
});
