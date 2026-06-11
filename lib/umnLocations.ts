/**
 * umnLocations.ts
 * Koordinat GPS lokasi-lokasi di kampus Universitas Multimedia Nusantara (UMN).
 * Digunakan sebagai preset lokasi di form laporan barang agar user tidak perlu mengetik manual.
 */

/** Titik pusat kampus UMN, digunakan sebagai fallback koordinat peta */
export const UMN_CENTER = {
  latitude: -6.2567,
  longitude: 106.6182,
  address: 'Universitas Multimedia Nusantara, Gading Serpong, Tangerang',
};

/** Daftar lokasi spesifik di kampus UMN beserta koordinat GPS-nya */
export const UMN_LOCATIONS = [
  { id: 'umn_main', label: 'Gedung Utama', latitude: -6.2567, longitude: 106.6182 },
  { id: 'umn_b', label: 'Gedung B', latitude: -6.2566495, longitude: 106.6183551 },
  { id: 'umn_c', label: 'Gedung C', latitude: -6.257135, longitude: 106.6192675 },
  { id: 'umn_d', label: 'Gedung D', latitude: -6.2565172, longitude: 106.6188249 },
  { id: 'umn_kantin', label: 'Kantin / Food Court', latitude: -6.2572276, longitude: 106.6190713 },
  { id: 'umn_parkir', label: 'Area Parkir', latitude: -6.2575, longitude: 106.6173 },
];
