import { View, TouchableOpacity, Text, StyleSheet, Linking, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
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
  const mapUrl =
    `https://www.openstreetmap.org/export/embed.html` +
    `?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;

  const openInMaps = () => {
    const label = encodeURIComponent(title);
    const url =
      Platform.OS === 'ios'
        ? `maps://q=${latitude},${longitude}`
        : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/maps?q=${latitude},${longitude}`);
    });
  };

  return (
    <View>
      <View style={[styles.mapContainer, { height }]}>
        <WebView
          source={{ uri: mapUrl }}
          style={styles.webview}
          scrollEnabled={false}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          originWhitelist={['*']}
        />
      </View>
      <TouchableOpacity style={styles.openBtn} onPress={openInMaps}>
        <Text style={styles.openBtnText}>🗺 
          Buka Navigasi di Maps</Text>
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
  webview: { flex: 1 },
  openBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: APP_COLORS.primaryLight,
    alignItems: 'center',
  },
  openBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: APP_COLORS.primary,
  },
});
