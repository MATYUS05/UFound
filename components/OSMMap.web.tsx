import { View, TouchableOpacity, Text, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_COLORS } from '@/lib/types';
import { UMN_CENTER } from '@/lib/umnLocations';

interface OSMMapProps {
  latitude?: number;
  longitude?: number;
  title?: string;
  height?: number;
}

export default function OSMMap({
  latitude = UMN_CENTER.latitude,
  longitude = UMN_CENTER.longitude,
  title = 'Universitas Multimedia Nusantara',
  height = 200,
}: OSMMapProps) {
  const delta = 0.004;
  const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;
  const embedUrl =
    `https://www.openstreetmap.org/export/embed.html` +
    `?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;

  const openInMaps = () => {
    Linking.openURL(`https://maps.google.com/maps?q=${latitude},${longitude}`);
  };

  // On web, use a native <iframe> — safe in Expo Web / React Native Web
  const IFrame = 'iframe' as any;

  return (
    <View>
      <View style={[styles.mapContainer, { height }]}>
        <IFrame
          src={embedUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title={title}
          loading="lazy"
        />
      </View>
      <TouchableOpacity style={styles.openBtn} onPress={openInMaps}>
        <Ionicons name="map-outline" size={14} color={APP_COLORS.primary} />
        <Text style={styles.openBtnText}> Buka di Google Maps</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  openBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: APP_COLORS.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: APP_COLORS.primary,
  },
});
