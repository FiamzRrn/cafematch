export const origins = [
  { id: 'simpang-lima', label: 'Simpang Lima', lat: -6.9893202, lng: 110.4235821 },
  { id: 'kota-lama', label: 'Kota Lama', lat: -6.96723, lng: 110.4268983 },
  { id: 'tembalang', label: 'Tembalang / UNDIP', lat: -7.0515579, lng: 110.4395309 },
  { id: 'banyumanik', label: 'Banyumanik', lat: -7.0606682, lng: 110.4189276 },
]

export const semarangSearchAreas = [
  { id: 'kota-lama', lat: -6.969, lng: 110.429 },
  { id: 'semarang-utara', lat: -6.952, lng: 110.423 },
  { id: 'semarang-tengah', lat: -6.984, lng: 110.416 },
  { id: 'candisari', lat: -7.015, lng: 110.427 },
  { id: 'pedurungan', lat: -7.008, lng: 110.474 },
  { id: 'tembalang', lat: -7.051, lng: 110.44 },
  { id: 'banyumanik', lat: -7.064, lng: 110.418 },
  { id: 'gunungpati', lat: -7.102, lng: 110.39 },
  { id: 'ngaliyan', lat: -6.99, lng: 110.33 },
  { id: 'mijen', lat: -7.055, lng: 110.318 },
  { id: 'tugu', lat: -6.978, lng: 110.292 },
]

export const defaultPreferences = {
  originId: 'simpang-lima',
  radiusKm: 30,
  minRating: 0,
  maxPriceLevel: 5,
  openNow: false,
}

export const priceLevels = [
  { value: 0, label: 'Semua harga' },
  { value: 1, label: 'Gratis' },
  { value: 2, label: 'Terjangkau' },
  { value: 3, label: 'Sedang' },
  { value: 4, label: 'Mahal' },
  { value: 5, label: 'Sangat mahal' },
]

export function getPriceLevel(place) {
  const levels = {
    PRICE_LEVEL_FREE: 1,
    PRICE_LEVEL_INEXPENSIVE: 2,
    PRICE_LEVEL_MODERATE: 3,
    PRICE_LEVEL_EXPENSIVE: 4,
    PRICE_LEVEL_VERY_EXPENSIVE: 5,
  }

  return levels[place.priceLevel] ?? 0
}
