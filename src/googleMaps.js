import { semarangSearchAreas } from './cafes.js'

const SEARCH_RADIUS_METERS = 4200
const MAX_RESULTS_PER_AREA = 20
const SEARCH_CONCURRENCY = 3

let mapsApiPromise

export function loadGoogleMapsApi(apiKey) {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps)
  if (!apiKey) return Promise.reject(new Error('Tambahkan VITE_GOOGLE_MAPS_API_KEY di .env.local untuk mengaktifkan Google Maps.'))
  if (mapsApiPromise) return mapsApiPromise

  mapsApiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const params = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      libraries: 'places',
      language: 'id',
      region: 'ID',
    })
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`
    script.async = true
    script.onerror = () => {
      mapsApiPromise = undefined
      reject(new Error('Google Maps JavaScript API gagal dimuat. Periksa koneksi, API key, dan HTTP referrer restrictions.'))
    }
    script.onload = () => {
      if (window.google?.maps?.importLibrary) {
        resolve(window.google.maps)
      } else {
        mapsApiPromise = undefined
        reject(new Error('Google Maps gagal diinisialisasi. Pastikan Maps JavaScript API aktif dan key memiliki izin domain yang sesuai.'))
      }
    }
    document.head.append(script)
  })

  return mapsApiPromise
}

function photoData(photo) {
  return {
    url: photo.getURI({ maxWidth: 1200 }),
    attributions: (Array.isArray(photo.authorAttributions) ? photo.authorAttributions : []).map((attribution) => ({
      name: attribution.displayName,
      url: attribution.uri,
    })),
  }
}

export function normalizePlace(place) {
  const location = place.location?.toJSON
    ? place.location.toJSON()
    : { lat: place.location?.lat, lng: place.location?.lng }
  const photos = Array.isArray(place.photos) ? place.photos : []

  return {
    id: place.id,
    name: place.displayName?.text || 'Nama kedai tidak tersedia',
    address: place.formattedAddress || 'Alamat tidak tersedia',
    lat: location.lat,
    lng: location.lng,
    googleMapsURI: place.googleMapsURI || `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place.id)}`,
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? 0,
    priceLevel: place.priceLevel || '',
    businessStatus: place.businessStatus || '',
    primaryType: place.primaryTypeDisplayName?.text || place.primaryType || '',
    types: place.types || [],
    openNow: typeof place.isOpen === 'function' ? place.isOpen() : undefined,
    openingHours: place.regularOpeningHours?.weekdayDescriptions || [],
    photos: photos.map(photoData),
    phone: place.nationalPhoneNumber || '',
    website: place.websiteURI || '',
  }
}

export async function searchSemarangCafes(Place, onProgress = () => {}) {
  const placesById = new Map()
  const failedAreas = []
  let nextAreaIndex = 0
  let completedAreas = 0

  async function searchWorker() {
    while (nextAreaIndex < semarangSearchAreas.length) {
      const area = semarangSearchAreas[nextAreaIndex]
      nextAreaIndex += 1

      try {
        const { places = [] } = await Place.searchNearby({
          fields: [
            'id',
            'displayName',
            'formattedAddress',
            'location',
            'googleMapsURI',
            'rating',
            'userRatingCount',
            'priceLevel',
            'businessStatus',
            'primaryType',
            'primaryTypeDisplayName',
            'types',
            'regularOpeningHours',
            'photos',
          ],
          includedTypes: ['cafe', 'coffee_shop'],
          locationRestriction: {
            circle: {
              center: { lat: area.lat, lng: area.lng },
              radius: SEARCH_RADIUS_METERS,
            },
          },
          maxResultCount: MAX_RESULTS_PER_AREA,
        })

        for (const place of places) {
          if (place.id && place.businessStatus !== 'CLOSED_PERMANENTLY') {
            placesById.set(place.id, place)
          }
        }
      } catch (error) {
        failedAreas.push({ id: area.id, error })
      } finally {
        completedAreas += 1
        onProgress({ completed: completedAreas, total: semarangSearchAreas.length })
      }
    }
  }

  await Promise.all(
    Array.from({ length: SEARCH_CONCURRENCY }, () => searchWorker()),
  )

  return {
    places: Array.from(placesById.values()),
    failedAreas,
    searchedAreas: semarangSearchAreas.length,
  }
}

export async function fetchPlaceById(Place, id) {
  const place = new Place({ id })
  await place.fetchFields({
    fields: [
      'id',
      'displayName',
      'formattedAddress',
      'location',
      'googleMapsURI',
      'rating',
      'userRatingCount',
      'priceLevel',
      'businessStatus',
      'primaryType',
      'primaryTypeDisplayName',
      'types',
      'regularOpeningHours',
      'photos',
      'websiteURI',
      'nationalPhoneNumber',
    ],
  })

  return place
}
