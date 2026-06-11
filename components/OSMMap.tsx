import { View, TouchableOpacity, Text, StyleSheet, Linking, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { APP_COLORS } from '@/lib/types';
import { UMN_CENTER } from '@/lib/umnLocations';

interface OSMMapProps {
  latitude?: number;
  longitude?: number;
  title?: string;
  height?: number;
}

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function buildMapHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body, #map { width:100%; height:100%; }
.leaflet-control-attribution, .leaflet-control-zoom { display:none; }
</style>
</head>
<body>
<div id="map"></div>
<script>
var map = L.map('map', {
  zoomControl:false, dragging:false, touchZoom:false,
  scrollWheelZoom:false, doubleClickZoom:false, attributionControl:false
}).setView([${lat}, ${lng}], 17);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom:19 }).addTo(map);
var pin = L.divIcon({
  html: '<div style="width:28px;height:28px;background:${APP_COLORS.primary};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>',
  iconSize:[28,28], iconAnchor:[14,28], className:''
});
L.marker([${lat}, ${lng}], {icon:pin}).addTo(map);
</script>
</body>
</html>`;
}

export default function OSMMap({
  latitude = UMN_CENTER.latitude,
  longitude = UMN_CENTER.longitude,
  title = 'Universitas Multimedia Nusantara',
  height = 200,
}: OSMMapProps) {
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

  const useGoogleEmbed = !!GOOGLE_MAPS_KEY;
  const googleEmbedUri = `https://www.google.com/maps/embed/v1/view?key=${GOOGLE_MAPS_KEY}&center=${latitude},${longitude}&zoom=17&maptype=roadmap`;

  return (
    <View>
      <View style={[styles.mapContainer, { height }]}>
        {useGoogleEmbed ? (
          <WebView
            source={{ uri: googleEmbedUri }}
            style={styles.webview}
            scrollEnabled={false}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            startInLoadingState
          />
        ) : (
          <WebView
            source={{ html: buildMapHtml(latitude, longitude) }}
            style={styles.webview}
            scrollEnabled={false}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
          />
        )}
      </View>
      <TouchableOpacity style={styles.openBtn} onPress={openInMaps}>
        <Ionicons name="navigate-outline" size={14} color={APP_COLORS.primary} />
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
  webview: { flex: 1 },
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
  openBtnText: { fontSize: 13, fontWeight: '700', color: APP_COLORS.primary },
});
