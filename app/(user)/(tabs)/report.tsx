import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image as RNImage,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, uploadImageToCloudinary } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { CATEGORIES, APP_COLORS } from '@/lib/types';
import { UMN_CENTER, UMN_LOCATIONS } from '@/lib/umnLocations';
import OSMMap from '@/components/OSMMap';

export default function ReportScreen() {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    if (images.length >= 3) { Alert.alert('Maks. 3 foto'); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Izin diperlukan', 'Izinkan akses foto'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled) setImages((prev) => [...prev, result.assets[0].uri]);
  };

  const takePhoto = async () => {
    if (images.length >= 3) { Alert.alert('Maks. 3 foto'); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Izin diperlukan', 'Izinkan akses kamera'); return; }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled) setImages((prev) => [...prev, result.assets[0].uri]);
  };

  const getLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Izin diperlukan', 'Izinkan akses lokasi'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geocode = await Location.reverseGeocodeAsync(loc.coords);
      const addr = geocode[0];
      const address = [addr.street, addr.district, addr.city, addr.region]
        .filter(Boolean)
        .join(', ');
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, address });
    } catch {
      Alert.alert('Error', 'Gagal mendapatkan lokasi');
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('Error', 'Judul harus diisi'); return; }
    if (!category) { Alert.alert('Error', 'Pilih kategori barang'); return; }
    if (!location) { Alert.alert('Error', 'Ambil lokasi terlebih dahulu'); return; }
    if (!profile) return;

    setLoading(true);
    try {
      const uploadedImages: string[] = [];
      for (const uri of images) {
        const url = await uploadImageToCloudinary(uri);
        uploadedImages.push(url);
      }

      await addDoc(collection(db, 'items'), {
        title: title.trim(),
        description: description.trim(),
        category,
        images: uploadedImages.filter((u): u is string => typeof u === 'string' && u.startsWith('http')),
        location,
        foundBy: { uid: profile.uid, name: profile.name, nim: profile.nim },
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      Alert.alert('Berhasil', 'Laporan barang temuan berhasil dikirim', [
        { text: 'OK', onPress: () => { setTitle(''); setDescription(''); setCategory(''); setImages([]); setLocation(null); } },
      ]);
    } catch (err) {
      Alert.alert('Error', 'Gagal menyimpan laporan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Laporkan Barang Temuan</Text>
        <Text style={styles.headerSub}>Bantu pemiliknya menemukan barangnya kembali</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Photos */}
        <Text style={styles.sectionLabel}>Foto Barang</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={styles.photoRow}>
            {images.map((uri, idx) => (
              <View key={idx} style={styles.photoWrapper}>
                <RNImage source={{ uri }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhoto}
                  onPress={() => setImages((p) => p.filter((_, i) => i !== idx))}>
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 3 && (
              <View style={styles.addPhotoRow}>
                <TouchableOpacity style={styles.addPhoto} onPress={takePhoto}>
                  <Ionicons name="camera-outline" size={24} color={APP_COLORS.primary} style={{ marginBottom: 4 }} />
                  <Text style={styles.addPhotoText}>Kamera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addPhoto} onPress={pickImage}>
                  <Ionicons name="images-outline" size={24} color={APP_COLORS.primary} style={{ marginBottom: 4 }} />
                  <Text style={styles.addPhotoText}>Galeri</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Title */}
        <Text style={styles.sectionLabel}>Nama Barang *</Text>
        <TextInput
          style={styles.input}
          placeholder="Contoh: Dompet Hitam, HP Samsung..."
          placeholderTextColor={APP_COLORS.textLight}
          value={title}
          onChangeText={setTitle}
        />

        {/* Category */}
        <Text style={styles.sectionLabel}>Kategori *</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryBtn, category === cat.id && styles.categoryBtnActive]}
              onPress={() => setCategory(cat.id)}>
              <Ionicons
                name={cat.icon as any}
                size={16}
                color={category === cat.id ? APP_COLORS.primary : APP_COLORS.textMuted}
              />
              <Text style={[styles.categoryBtnText, category === cat.id && styles.categoryBtnTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.sectionLabel}>Deskripsi</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Ciri-ciri, warna, kondisi barang..."
          placeholderTextColor={APP_COLORS.textLight}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Location */}
        <Text style={styles.sectionLabel}>Lokasi Ditemukan *</Text>

        {/* UMN Preset Locations */}
        <View style={styles.locationHintRow}>
          <Ionicons name="pin-outline" size={12} color={APP_COLORS.textMuted} />
          <Text style={styles.locationHint}> Pilih lokasi di kampus UMN:</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 10 }}
          contentContainerStyle={{ gap: 8 }}>
          {UMN_LOCATIONS.map((loc) => (
            <TouchableOpacity
              key={loc.id}
              style={[
                styles.locChip,
                location?.address === loc.label && styles.locChipActive,
              ]}
              onPress={() =>
                setLocation({ latitude: loc.latitude, longitude: loc.longitude, address: loc.label })
              }>
              <Text
                style={[
                  styles.locChipText,
                  location?.address === loc.label && styles.locChipTextActive,
                ]}>
                {loc.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* GPS Button */}
        <TouchableOpacity style={styles.locationBtn} onPress={getLocation} disabled={loadingLocation}>
          {loadingLocation ? (
            <ActivityIndicator size="small" color={APP_COLORS.primary} />
          ) : (
            <Ionicons name="navigate-outline" size={22} color={APP_COLORS.primary} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.locationBtnText}>
              {location ? location.address : 'Atau gunakan GPS saat ini'}
            </Text>
          </View>
          {location && <Ionicons name="checkmark-circle" size={20} color={APP_COLORS.success} />}
        </TouchableOpacity>

        {/* Map Preview */}
        {location && (
          <View style={{ marginBottom: 16 }}>
            <OSMMap
              latitude={location.latitude}
              longitude={location.longitude}
              title={location.address}
              height={160}
            />
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Kirim Laporan</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.background },
  header: { backgroundColor: APP_COLORS.primary, paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: APP_COLORS.text, marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: APP_COLORS.text,
    borderWidth: 1.5,
    borderColor: APP_COLORS.border,
    marginBottom: 16,
  },
  textarea: { minHeight: 100 },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoWrapper: { position: 'relative' },
  photo: { width: 100, height: 100, borderRadius: 12 },
  removePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: APP_COLORS.error,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  addPhotoRow: { flexDirection: 'row', gap: 10 },
  addPhoto: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: APP_COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  addPhotoText: { fontSize: 11, color: APP_COLORS.textMuted, fontWeight: '600' },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: APP_COLORS.border,
    gap: 6,
  },
  categoryBtnActive: { backgroundColor: APP_COLORS.primaryLight, borderColor: APP_COLORS.primary },
  categoryBtnText: { fontSize: 12, fontWeight: '600', color: APP_COLORS.textMuted },
  categoryBtnTextActive: { color: APP_COLORS.primary },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: APP_COLORS.border,
    marginBottom: 16,
    gap: 10,
  },
  locationBtnText: { fontSize: 14, fontWeight: '600', color: APP_COLORS.text },
  locationAddress: { fontSize: 12, color: APP_COLORS.textMuted, marginTop: 2 },
  locationHintRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  locationHint: { fontSize: 12, color: APP_COLORS.textMuted },
  locChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: APP_COLORS.border,
  },
  locChipActive: { backgroundColor: APP_COLORS.primaryLight, borderColor: APP_COLORS.primary },
  locChipText: { fontSize: 12, fontWeight: '600', color: APP_COLORS.textMuted },
  locChipTextActive: { color: APP_COLORS.primary },
  submitBtn: {
    backgroundColor: APP_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
