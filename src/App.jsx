import { useEffect, useMemo, useRef, useState } from 'react'
import { defaultPreferences, getPriceLevel, origins, priceLevels } from './cafes.js'
import { fetchPlaceById, loadGoogleMapsApi, normalizePlace, searchSemarangCafes } from './googleMaps.js'
import { rankPlaces } from './recommendation.js'
import './App.css'

const STORAGE_KEY = 'cafematch-google-maps-v1'
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || ''

const defaultStore = {
  preferences: defaultPreferences,
  favorites: [],
  favoriteNotes: {},
}

const ratingPoints = [
  { key: 'rating', title: 'Rating Google Maps', weight: 50, detail: 'Rating 0–5 dikonversi proporsional menjadi maksimal 50 poin.' },
  { key: 'reviews', title: 'Jumlah ulasan', weight: 15, detail: 'Jumlah ulasan menjadi indikator keyakinan data, maksimal 15 poin.' },
  { key: 'currentHours', title: 'Buka sekarang', weight: 15, detail: 'Kedai yang sedang buka menurut jam Google mendapat 15 poin.' },
  { key: 'proximity', title: 'Jarak', weight: 18, detail: 'Semakin dekat dengan titik awal, semakin besar poin hingga maksimal 18.' },
]

function readStore() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaultStore
    const parsed = JSON.parse(stored)
    return {
      preferences: { ...defaultPreferences, ...parsed.preferences },
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter((id) => typeof id === 'string') : [],
      favoriteNotes: parsed.favoriteNotes && typeof parsed.favoriteNotes === 'object' ? parsed.favoriteNotes : {},
    }
  } catch (error) {
    console.error('Gagal membaca pengaturan CafeMatch dari penyimpanan lokal.', error)
    return defaultStore
  }
}

function Icon({ children, className = '' }) {
  return <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>{children}</span>
}

function formatDistance(distance) {
  return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`
}

function formatPrice(place) {
  const level = getPriceLevel(place)
  if (!level) return 'Harga belum tersedia'
  return priceLevels.find((option) => option.value === level)?.label || 'Harga belum tersedia'
}

function getPlaceLink(place) {
  return place.googleMapsURI || `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place.id)}`
}

function MapPanel({ places, origin, apiKey }) {
  const mapElement = useRef(null)
  const mapInstance = useRef(null)
  const markerInstances = useRef([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState('')

  useEffect(() => {
    let active = true
    if (!apiKey) return undefined

    async function initializeMap() {
      const maps = await loadGoogleMapsApi(apiKey)
      const { Map: GoogleMap } = await maps.importLibrary('maps')
      if (!active || !mapElement.current) return

      mapInstance.current = new GoogleMap(mapElement.current, {
        center: { lat: origin.lat, lng: origin.lng },
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        mapTypeId: 'roadmap',
      })
      setMapLoaded(true)
    }

    initializeMap().catch((error) => {
      console.error('Gagal menampilkan peta Google Maps.', error)
      if (active) setMapError(error.message)
    })

    return () => {
      active = false
      markerInstances.current.forEach((marker) => marker.setMap(null))
      markerInstances.current = []
      mapInstance.current = null
      setMapLoaded(false)
    }
  }, [apiKey, origin])

  useEffect(() => {
    if (!mapLoaded || !mapInstance.current || !window.google?.maps) return

    markerInstances.current.forEach((marker) => marker.setMap(null))
    markerInstances.current = []
    const bounds = new window.google.maps.LatLngBounds()
    bounds.extend({ lat: origin.lat, lng: origin.lng })

    for (const place of places) {
      if (typeof place.lat !== 'number' || typeof place.lng !== 'number') continue
      markerInstances.current.push(new window.google.maps.Marker({
        map: mapInstance.current,
        position: { lat: place.lat, lng: place.lng },
        title: place.name,
      }))
      bounds.extend({ lat: place.lat, lng: place.lng })
    }

    if (places.length) {
      mapInstance.current.fitBounds(bounds, 56)
    } else {
      mapInstance.current.setCenter({ lat: origin.lat, lng: origin.lng })
      mapInstance.current.setZoom(12)
    }
  }, [mapLoaded, origin, places])

  return (
    <section className="map-panel" aria-label="Peta kedai kopi">
      {apiKey ? (
        <>
          <div className="google-map" ref={mapElement} />
          {mapError && <p className="map-error" role="status">{mapError}</p>}
        </>
      ) : (
        <div className="map-placeholder">
          <Icon>map</Icon>
          <strong>Peta Google Maps</strong>
          <span>Tambahkan API key untuk menampilkan peta kedai.</span>
        </div>
      )}
      <a className="maps-attribution" href="https://maps.google.com" rel="noreferrer" target="_blank">Google Maps</a>
    </section>
  )
}

function PhotoGallery({ place, compact = false }) {
  if (!place.photos.length) {
    return (
      <div className={`photo-empty ${compact ? 'compact' : ''}`}>
        <Icon>photo_camera</Icon>
        <span>Belum ada foto Google Maps untuk tempat ini.</span>
      </div>
    )
  }

  return (
    <div className={`photo-gallery ${compact ? 'compact' : ''}`}>
      {place.photos.slice(0, compact ? 1 : 6).map((photo, index) => (
        <figure className="google-photo" key={`${place.id}-${index}`}>
          <img alt={`Foto ${index + 1} dari Google Maps untuk ${place.name}`} loading="lazy" src={photo.url} />
          {photo.attributions.length > 0 && (
            <figcaption>
              {photo.attributions.map((attribution, attributionIndex) => (
                <span key={`${attribution.name}-${attributionIndex}`}>
                  Foto oleh{' '}
                  {attribution.url
                    ? <a href={attribution.url} rel="noreferrer" target="_blank">{attribution.name}</a>
                    : attribution.name}
                  {attributionIndex < photo.attributions.length - 1 ? ', ' : ''}
                </span>
              ))}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}

function App() {
  const [store, setStore] = useState(readStore)
  const [view, setView] = useState('discover')
  const [places, setPlaces] = useState([])
  const [searchState, setSearchState] = useState('idle')
  const [searchProgress, setSearchProgress] = useState({ completed: 0, total: 0 })
  const [failedAreas, setFailedAreas] = useState([])
  const [searchError, setSearchError] = useState('')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('match')
  const [detailPlace, setDetailPlace] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [locationDialog, setLocationDialog] = useState(false)
  const [locationBusy, setLocationBusy] = useState(false)
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const [favoriteError, setFavoriteError] = useState('')
  const [message, setMessage] = useState('')
  const { preferences, favorites, favoriteNotes } = store
  const origin = preferences.customOrigin || origins.find((option) => option.id === preferences.originId) || origins[0]

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        preferences,
        favorites,
        favoriteNotes,
      }))
    } catch (error) {
      console.error('Gagal menyimpan preferensi CafeMatch ke penyimpanan lokal.', error)
    }
  }, [preferences, favorites, favoriteNotes])

  useEffect(() => {
    if (!message) return undefined
    const timeout = window.setTimeout(() => setMessage(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [message])

  useEffect(() => {
    if (!detailPlace) return undefined
    function handleEscape(event) {
      if (event.key === 'Escape') setDetailPlace(null)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [detailPlace])

  function updatePreferences(changes) {
    setStore((current) => ({
      ...current,
      preferences: { ...current.preferences, ...changes },
    }))
  }

  async function searchCafes() {
    if (!GOOGLE_MAPS_API_KEY) {
      setSearchError('Google Maps belum dikonfigurasi. Isi VITE_GOOGLE_MAPS_API_KEY di .env.local lalu jalankan ulang Vite.')
      setSearchState('error')
      return
    }

    setView('recommendations')
    setSearchState('loading')
    setSearchError('')
    setFailedAreas([])
    setPlaces([])
    setSearchProgress({ completed: 0, total: 0 })

    try {
      const maps = await loadGoogleMapsApi(GOOGLE_MAPS_API_KEY)
      const { Place } = await maps.importLibrary('places')
      const result = await searchSemarangCafes(Place, setSearchProgress)
      setFailedAreas(result.failedAreas.map(({ id }) => id))
      const normalizedPlaces = result.places.map(normalizePlace)
      setPlaces(normalizedPlaces)
      setSearchState('complete')
      if (result.failedAreas.length === result.searchedAreas) {
        setSearchError('Semua permintaan Google Maps gagal. Periksa API key, restriction domain, kuota, dan billing.')
      } else if (!result.places.length) {
        setSearchError('Google Maps tidak mengembalikan kedai. Periksa apakah Places API (New), Maps JavaScript API, dan billing aktif pada project Cloud.')
      }
    } catch (error) {
      console.error('Gagal mencari kedai dari Google Maps.', error)
      setSearchState('error')
      setSearchError(error.message || 'Pencarian Google Maps gagal.')
    }
  }

  async function loadFavorites() {
    if (!favorites.length) {
      setFavoriteError('')
      return
    }

    const existing = new Set(places.map((place) => place.id))
    const missingIds = favorites.filter((id) => !existing.has(id))
    if (!missingIds.length) {
      setFavoriteError('')
      return
    }
    if (!GOOGLE_MAPS_API_KEY) {
      setFavoriteError('Tambahkan API key Google Maps untuk memuat ulang detail favorit yang tersimpan.')
      return
    }

    setFavoriteBusy(true)
    setFavoriteError('')
    try {
      const maps = await loadGoogleMapsApi(GOOGLE_MAPS_API_KEY)
      const { Place } = await maps.importLibrary('places')
      const results = await Promise.allSettled(missingIds.map((id) => fetchPlaceById(Place, id)))
      const loaded = []
      const failures = []
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index]
        if (result.status === 'fulfilled') {
          loaded.push(normalizePlace(result.value))
        } else {
          console.error(`Gagal memuat detail Google Maps untuk place ID ${missingIds[index]}.`, result.reason)
          failures.push(missingIds[index])
        }
      }
      setPlaces((current) => [...current, ...loaded])
      if (failures.length) {
        setFavoriteError(`${failures.length} kedai favorit tidak dapat dimuat dari Google Maps. Periksa sambungan dan coba lagi.`)
      }
    } catch (error) {
      console.error('Gagal memuat data favorit Google Maps.', error)
      setFavoriteError(error.message || 'Favorit tidak dapat dimuat dari Google Maps.')
    } finally {
      setFavoriteBusy(false)
    }
  }

  function navigate(nextView) {
    setView(nextView)
    if (nextView === 'recommendations' && searchState === 'idle') void searchCafes()
    if (nextView === 'favorites') void loadFavorites()
  }

  function toggleFavorite(place) {
    const saved = favorites.includes(place.id)
    setStore((current) => ({
      ...current,
      favorites: saved
        ? current.favorites.filter((id) => id !== place.id)
        : [...current.favorites, place.id],
      favoriteNotes: saved
        ? Object.fromEntries(Object.entries(current.favoriteNotes).filter(([id]) => id !== place.id))
        : current.favoriteNotes,
    }))
    setMessage(saved ? 'Kedai dihapus dari favorit.' : 'Kedai disimpan di favorit.')
  }

  function saveFavoriteNote(placeId, note) {
    setStore((current) => ({
      ...current,
      favoriteNotes: { ...current.favoriteNotes, [placeId]: note.slice(0, 140) },
    }))
  }

  async function openDetails(placeId) {
    setDetailPlace(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      const maps = await loadGoogleMapsApi(GOOGLE_MAPS_API_KEY)
      const { Place } = await maps.importLibrary('places')
      const place = await fetchPlaceById(Place, placeId)
      setDetailPlace(normalizePlace(place))
    } catch (error) {
      console.error('Gagal memuat detail kedai dari Google Maps.', error)
      setDetailError(error.message || 'Detail kedai tidak dapat dimuat.')
    } finally {
      setDetailLoading(false)
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage('Browser ini tidak mendukung lokasi perangkat.')
      return
    }
    setLocationBusy(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude, longitude } = coords
        const inSemarang = latitude >= -7.22 && latitude <= -6.9 && longitude >= 110.24 && longitude <= 110.53
        setLocationBusy(false)
        if (!inSemarang) {
          setMessage('Lokasi perangkat berada di luar area Kota Semarang.')
          return
        }
        updatePreferences({
          customOrigin: { id: 'gps', label: 'Lokasi saya', lat: latitude, lng: longitude },
        })
        setLocationDialog(false)
      },
      (error) => {
        setLocationBusy(false)
        console.error('Gagal mendapatkan lokasi perangkat.', error)
        setMessage(error.code === error.PERMISSION_DENIED
          ? 'Izin lokasi ditolak. Pilih titik awal secara manual.'
          : 'Lokasi tidak dapat diambil. Periksa izin dan koneksi browser.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  async function sharePlace(place) {
    const url = getPlaceLink(place)
    try {
      if (navigator.share) {
        await navigator.share({ title: `${place.name} · CafeMatch Semarang`, url })
      } else {
        await navigator.clipboard.writeText(url)
        setMessage('Tautan Google Maps berhasil disalin.')
      }
    } catch (error) {
      if (error.name === 'AbortError') return
      console.error('Gagal membagikan tautan Google Maps.', error)
      setMessage('Tautan tidak dapat dibagikan.')
    }
  }

  const currentPlaceIds = new Set(places.map((place) => place.id))
  const savedPlaces = favorites
    .map((id) => places.find((place) => place.id === id))
    .filter(Boolean)

  const rankedResults = useMemo(
    () => rankPlaces(places, origin, preferences, sortBy),
    [places, origin, preferences, sortBy],
  )

  const baseResults = view === 'favorites'
    ? rankPlaces(savedPlaces, origin, { ...preferences, radiusKm: 1000, openNow: false, minRating: 0, maxPriceLevel: 0 }, sortBy)
    : rankedResults

  const filteredResults = baseResults.filter(({ place }) => {
    const searchableText = `${place.name} ${place.address} ${place.primaryType} ${place.types.join(' ')}`.toLowerCase()
    return searchableText.includes(query.toLowerCase())
  })

  const navigation = [
    { id: 'discover', icon: 'search', label: 'Cari Kedai' },
    { id: 'recommendations', icon: 'map', label: 'Hasil Pencarian', count: places.length },
    { id: 'favorites', icon: 'favorite', label: 'Favorit Saya', count: favorites.length },
    { id: 'logic', icon: 'psychology', label: 'Cara Rekomendasi' },
  ]

  function resultCard(place, distance, score, breakdown) {
    const isSaved = favorites.includes(place.id)
    return (
      <article className="cafe-card" key={place.id}>
        <PhotoGallery compact place={place} />
        <div className="cafe-info">
          <div className="cafe-meta">
            <span>{place.address}</span>
            <span>{formatDistance(distance)}</span>
          </div>
          <h3>{place.name}</h3>
          <div className="place-facts">
            <span className="place-rating">
              <Icon>star</Icon>{place.rating == null ? 'Belum ada rating' : place.rating.toFixed(1)}
              {place.userRatingCount > 0 && <small>({place.userRatingCount.toLocaleString('id-ID')})</small>}
            </span>
            <span className="price-label">{formatPrice(place)}</span>
            {place.openNow !== undefined && (
              <span className={`open-label ${place.openNow ? 'is-open' : 'is-closed'}`}>
                {place.openNow ? 'Buka sekarang' : 'Tutup sekarang'}
              </span>
            )}
          </div>
          {place.primaryType && <p className="place-type">{place.primaryType}</p>}
          <div className="cafe-actions">
            <a className="button button-primary map-button" href={getPlaceLink(place)} rel="noreferrer" target="_blank">
              <Icon>near_me</Icon>Lihat di Google Maps
            </a>
            <button className="button button-outline" onClick={() => void openDetails(place.id)} type="button">Detail</button>
            <button
              aria-label={isSaved ? `Hapus ${place.name} dari favorit` : `Simpan ${place.name} ke favorit`}
              aria-pressed={isSaved}
              className={`favorite-button ${isSaved ? 'saved' : ''}`}
              onClick={() => toggleFavorite(place)}
              type="button"
            ><Icon>{isSaved ? 'favorite' : 'favorite_border'}</Icon></button>
            <button aria-label={`Bagikan ${place.name}`} className="favorite-button" onClick={() => void sharePlace(place)} type="button">
              <Icon>share</Icon>
            </button>
          </div>
          <details className="score-details">
            <summary>Skor urutan {score}/98 — rincian aturan</summary>
            <div className="score-rule-list">
              {ratingPoints.map((rule) => (
                <span key={rule.key}>{rule.title}: {Math.round(breakdown[rule.key])}/{rule.weight}</span>
              ))}
            </div>
          </details>
          {view === 'favorites' && (
            <label className="favorite-note">
              Catatan kunjungan
              <textarea
                aria-label={`Catatan untuk ${place.name}`}
                maxLength="140"
                onChange={(event) => saveFavoriteNote(place.id, event.target.value)}
                placeholder="Tulis catatan pribadi..."
                rows="2"
                value={favoriteNotes[place.id] || ''}
              />
              <small>{(favoriteNotes[place.id] || '').length}/140</small>
            </label>
          )}
        </div>
      </article>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <a className="brand" href="#" onClick={(event) => { event.preventDefault(); navigate('discover') }}>
            <span className="brand-mark"><Icon>coffee</Icon></span>
            <span className="brand-copy">
              <span className="brand-name">CafeMatch</span>
              <span className="brand-caption">Google Maps · Semarang</span>
            </span>
          </a>
          <nav aria-label="Navigasi utama" className="side-nav">
            {navigation.map((item) => (
              <button
                aria-current={view === item.id ? 'page' : undefined}
                className={`nav-link ${view === item.id ? 'active' : ''}`}
                key={item.id}
                onClick={() => navigate(item.id)}
                type="button"
              >
                <span className="nav-link-label"><Icon>{item.icon}</Icon>{item.label}</span>
                {item.count > 0 && <span className="nav-count">{item.count}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="location-chip">
            <span><Icon>location_on</Icon>{origin.label}, Semarang</span>
            <button onClick={() => setLocationDialog(true)} type="button">Ubah</button>
          </div>
          <p className="engine-status"><span className={`status-dot ${GOOGLE_MAPS_API_KEY ? '' : 'status-off'}`} />Google Places API {GOOGLE_MAPS_API_KEY ? '• Siap' : '• Perlu API key'}</p>
          <div className="profile">
            <span className="avatar">CM</span>
            <span><strong>Penikmat kopi</strong><small>Preferensi tersimpan lokal</small></span>
            <Icon className="profile-settings">settings</Icon>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div className="page-heading">
            <div className="eyebrow"><span className={`status-dot ${GOOGLE_MAPS_API_KEY ? '' : 'status-off'}`} />KEDAI KOPI · KOTA SEMARANG</div>
            <h1>{view === 'discover' ? 'Jelajahi kedai kopi' : view === 'recommendations' ? 'Kedai di Semarang' : view === 'favorites' ? 'Favorit Saya' : 'Cara rekomendasi'}</h1>
            <p>{view === 'discover'
              ? 'Temukan kedai yang benar-benar terdaftar di Google Maps, lengkap dengan rating, jam buka, dan foto.'
              : view === 'recommendations'
                ? 'Hasil pencarian langsung dari Google Maps, tersebar di berbagai area Kota Semarang.'
                : view === 'favorites'
                  ? 'Kedai tersimpan di perangkat. Detail dan foto dimuat ulang dari Google Maps.'
                  : 'Urutan memakai atribut Google Maps yang tersedia, tanpa mengarang profil rasa atau fasilitas.'}</p>
          </div>
          {view === 'discover' && (
            <button className="button button-primary reset-button" disabled={searchState === 'loading'} onClick={() => void searchCafes()} type="button">
              <Icon>{searchState === 'loading' ? 'progress_activity' : 'search'}</Icon>
              {searchState === 'loading' ? `Mencari ${searchProgress.completed}/${searchProgress.total || 11} area` : 'Cari kedai Semarang'}
            </button>
          )}
        </header>

        {view === 'discover' && (
          <div className="content-wrap discovery-content">
            <section className="discovery-hero">
              <span className="eyebrow">DATA LANGSUNG DARI GOOGLE MAPS</span>
              <h2>Cari kopi enak,<br />mulai dari sekitarmu.</h2>
              <p>Jelajahi berbagai sudut Semarang dengan rating, alamat, jam buka, dan foto yang berasal dari Google Maps.</p>
              <div className="hero-location">
                <span><Icon>location_on</Icon><strong>{origin.label}, Semarang</strong></span>
                <button className="button button-outline" onClick={() => setLocationDialog(true)} type="button">Ubah titik awal</button>
              </div>
            </section>

            <section aria-labelledby="filters-heading" className="panel">
              <div className="panel-heading">
                <div>
                  <div className="section-title"><Icon>tune</Icon><h2 id="filters-heading">Atur pencarian</h2></div>
                  <p>Pilih area, jarak, rating minimum, dan preferensi kunjungan.</p>
                </div>
                <span className="count-pill">Google Places</span>
              </div>
              <div className="discovery-filters">
                <div className="radius-control">
                  <div className="radius-heading">
                    <div><strong>Radius dari {origin.label}</strong><small>Jarak garis lurus dari titik awal.</small></div>
                    <span className="radius-value">{preferences.radiusKm} km</span>
                  </div>
                  <label className="visually-hidden" htmlFor="radius-slider">Radius pencarian dalam kilometer</label>
                  <input id="radius-slider" max="30" min="1" onChange={(event) => updatePreferences({ radiusKm: Number(event.target.value) })} type="range" value={preferences.radiusKm} />
                  <div className="radius-presets">
                    {[3, 5, 10, 20, 30].map((distance) => (
                      <button
                        aria-pressed={preferences.radiusKm === distance}
                        className={preferences.radiusKm === distance ? 'selected' : ''}
                        key={distance}
                        onClick={() => updatePreferences({ radiusKm: distance })}
                        type="button"
                      >{distance} km</button>
                    ))}
                  </div>
                </div>
                <label className="select-field filter-select">
                  <span>Rating minimum</span>
                  <select onChange={(event) => updatePreferences({ minRating: Number(event.target.value) })} value={preferences.minRating}>
                    <option value="0">Semua rating</option>
                    <option value="3">3.0 ke atas</option>
                    <option value="4">4.0 ke atas</option>
                    <option value="4.5">4.5 ke atas</option>
                  </select>
                </label>
                <label className="select-field filter-select">
                  <span>Batas harga</span>
                  <select onChange={(event) => updatePreferences({ maxPriceLevel: Number(event.target.value) })} value={preferences.maxPriceLevel}>
                    <option value="5">Semua harga</option>
                    <option value="2">Gratis / terjangkau</option>
                    <option value="3">Sedang ke bawah</option>
                    <option value="4">Mahal ke bawah</option>
                  </select>
                </label>
                <label className="toggle-row">
                  <span><strong>Hanya yang buka</strong><small>Mengikuti jam terkini dari Google Maps</small></span>
                  <input checked={preferences.openNow} onChange={(event) => updatePreferences({ openNow: event.target.checked })} type="checkbox" />
                  <span aria-hidden="true" className="toggle-track" />
                </label>
              </div>
            </section>

            <section className="action-panel">
              <div className="action-copy">
                <span className="action-icon"><Icon>travel_explore</Icon></span>
                <span>
                  <small>PENCARIAN KOTA SEMARANG</small>
                  <strong>Jelajahi pusat kota sampai area pinggiran.</strong>
                  <span>Data kedai dan foto tidak disimpan sebagai katalog lokal.</span>
                </span>
              </div>
              <button className="button button-primary action-button" disabled={searchState === 'loading'} onClick={() => void searchCafes()} type="button">
                {searchState === 'loading' ? 'Sedang mencari...' : 'Tampilkan kedai'}<Icon>arrow_forward</Icon>
              </button>
            </section>

            {!GOOGLE_MAPS_API_KEY && (
              <section className="setup-notice" role="status">
                <Icon>key</Icon>
                <div>
                  <strong>Masukkan API key Google Maps Platform</strong>
                  <p>Salin <code>.env.example</code> menjadi <code>.env.local</code>, lalu isi <code>VITE_GOOGLE_MAPS_API_KEY</code>. Aktifkan Places API (New) dan Maps JavaScript API; batasi key dengan HTTP referrer serta API restrictions, dan mulai ulang server Vite.</p>
                </div>
              </section>
            )}

            {searchError && <p className="inline-error" role="alert">{searchError}</p>}
          </div>
        )}

        {(view === 'recommendations' || view === 'favorites') && (
          <div className="content-wrap results-layout">
            <section className="results-column">
              <div className="results-toolbar">
                <div>
                  <span className="eyebrow">{view === 'favorites' ? 'KOLEKSI LOKAL' : 'GOOGLE PLACES · SEMARANG'}</span>
                  <h2>{view === 'favorites' ? `${favorites.length} tersimpan` : `${filteredResults.length} kedai ditemukan`}</h2>
                </div>
                <button className="button button-outline" onClick={() => setView('discover')} type="button"><Icon>tune</Icon>Filter</button>
              </div>
              <div className="results-filters">
                <label className="search-field">
                  <Icon>search</Icon>
                  <input aria-label="Cari nama atau alamat kedai" onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama kedai atau alamat..." value={query} />
                  {query && <button aria-label="Hapus pencarian" onClick={() => setQuery('')} type="button"><Icon>close</Icon></button>}
                </label>
                <label className="select-field">
                  <span>Urutkan</span>
                  <select onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                    <option value="match">Rekomendasi</option>
                    <option value="rating">Rating tertinggi</option>
                    <option value="distance">Terdekat</option>
                    <option value="reviews">Ulasan terbanyak</option>
                  </select>
                </label>
              </div>

              {view === 'recommendations' && searchState === 'loading' && (
                <div className="loading-state" role="status">
                  <span className="loading-mark"><Icon>coffee</Icon></span>
                  <strong>Mencari kedai kopi di Semarang</strong>
                  <span>{searchProgress.completed ? `Selesai mencari ${searchProgress.completed} dari ${searchProgress.total} area.` : 'Menghubungkan ke Google Maps...'}</span>
                </div>
              )}
              {view === 'recommendations' && failedAreas.length > 0 && places.length > 0 && (
                <p className="inline-error" role="status">Sebagian area belum berhasil dimuat ({failedAreas.length}). Hasil dapat belum mencakup semua tempat.</p>
              )}
              {view === 'recommendations' && searchError && <p className="inline-error" role="alert">{searchError}</p>}
              {favoriteError && view === 'favorites' && <p className="inline-error" role="alert">{favoriteError}</p>}
              {favoriteBusy && view === 'favorites' && <p className="loading-note" role="status">Memuat detail favorit dari Google Maps...</p>}

              {searchState !== 'loading' && filteredResults.length > 0 && (
                <div className="result-list">
                  {filteredResults.map(({ place, distance, score, breakdown }) => resultCard(place, distance, score, breakdown))}
                </div>
              )}

              {searchState !== 'loading' && !filteredResults.length && (
                <div className="empty-state">
                  <span className="empty-icon"><Icon>{view === 'favorites' ? 'favorite_border' : 'search_off'}</Icon></span>
                  <h3>{view === 'favorites'
                    ? favorites.length ? 'Favorit belum dimuat' : 'Belum ada kedai tersimpan'
                    : searchState === 'idle' ? 'Mulai pencarian kedai' : searchState === 'error' ? 'Pencarian tidak tersedia' : 'Kedai tidak ditemukan'}</h3>
                  <p>{view === 'favorites'
                    ? favorites.length ? 'Pastikan API key aktif untuk memuat detail dan foto dari Google Maps.' : 'Simpan kedai dari hasil Google Maps untuk mengumpulkan pilihan Anda.'
                    : searchState === 'idle' ? 'Jalankan pencarian untuk menemukan kedai kopi di berbagai area Semarang.' : searchState === 'error' ? 'Periksa konfigurasi dan akses Google Maps Platform, lalu coba lagi.' : 'Coba perluas radius atau kurangi filter rating dan harga.'}</p>
                  {view === 'favorites' && favorites.length > 0
                    ? <button className="button button-primary" disabled={favoriteBusy} onClick={() => void loadFavorites()} type="button">Muat ulang favorit</button>
                    : view === 'recommendations'
                      ? <button className="button button-primary" disabled={searchState === 'loading'} onClick={() => void searchCafes()} type="button">Cari kedai lagi</button>
                      : view === 'favorites'
                        ? <button className="button button-primary" onClick={() => navigate('recommendations')} type="button">Jelajahi kedai</button>
                        : null}
                </div>
              )}

              <div className="data-notice">
                Google Places menyajikan hingga 20 hasil per area pencarian. Cakupan dan urutan mengikuti ketersediaan serta relevansi Google Maps; hasil bukan jaminan daftar usaha yang sepenuhnya lengkap.
              </div>
              <footer className="page-footer">
                <span className="google-wordmark">Google Maps</span>
                <span>Foto hanya ditampilkan dengan atribusi yang disediakan Google.</span>
                <a href="/privacy.html">Privasi</a>
                <a href="/terms.html">Ketentuan</a>
              </footer>
            </section>
            <MapPanel apiKey={GOOGLE_MAPS_API_KEY} origin={origin} places={filteredResults.map(({ place }) => place)} />
          </div>
        )}

        {view === 'logic' && (
          <div className="content-wrap logic-content">
            <section className="logic-intro">
              <span className="logic-mark"><Icon>psychology</Icon></span>
              <span className="eyebrow">URUTAN DARI DATA MAPS</span>
              <h2>Rating dan jarak,<br />bukan tebakan rasa.</h2>
              <p>Google Maps tidak menyediakan profil rasa atau suasana terverifikasi untuk setiap kafe. CafeMatch tidak mengarang atribut tersebut; urutan memakai rating, jumlah ulasan, jam buka, dan jarak yang tersedia.</p>
            </section>
            <div className="rule-list">
              {ratingPoints.map((rule) => (
                <article className="rule-item" key={rule.key}>
                  <span className="rule-weight">+{rule.weight}</span>
                  <div><h3>{rule.title}</h3><p>{rule.detail}</p></div>
                  <span className="rule-bar"><span style={{ width: `${rule.weight / 50 * 100}%` }} /></span>
                </article>
              ))}
            </div>
            <p className="data-notice">Place ID adalah satu-satunya data Places yang disimpan di browser untuk favorit. Detail, rating, jam, serta foto diminta ulang saat digunakan; hasil Places tidak dijadikan katalog persisten.</p>
            <footer className="page-footer">
              <span className="google-wordmark">Google Maps</span>
              <a href="/privacy.html">Privasi</a>
              <a href="/terms.html">Ketentuan</a>
            </footer>
            <button className="button button-primary" onClick={() => setView('discover')} type="button">Atur pencarian <Icon>arrow_forward</Icon></button>
          </div>
        )}
      </main>

      {locationDialog && (
        <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setLocationDialog(false) }}>
          <section aria-labelledby="location-title" aria-modal="true" className="location-dialog" role="dialog">
            <button aria-label="Tutup pilihan lokasi" className="dialog-close" onClick={() => setLocationDialog(false)} type="button"><Icon>close</Icon></button>
            <span className="eyebrow">TITIK AWAL PENCARIAN</span>
            <h2 id="location-title">Pilih area Semarang</h2>
            <p>Lokasi hanya digunakan di browser untuk menghitung jarak kedai.</p>
            <div className="origin-options">
              {origins.map((option) => (
                <button
                  aria-pressed={origin.id === option.id}
                  className={`origin-option ${origin.id === option.id ? 'selected' : ''}`}
                  key={option.id}
                  onClick={() => updatePreferences({ originId: option.id, customOrigin: undefined })}
                  type="button"
                >
                  <Icon>location_on</Icon>
                  <span><strong>{option.label}</strong><small>Semarang, Jawa Tengah</small></span>
                  <span className="selection-mark">{origin.id === option.id && <Icon>check</Icon>}</span>
                </button>
              ))}
            </div>
            <button className="button button-outline gps-button" disabled={locationBusy} onClick={useCurrentLocation} type="button">
              <Icon>{locationBusy ? 'progress_activity' : 'my_location'}</Icon>{locationBusy ? 'Mencari lokasi...' : 'Gunakan lokasi perangkat'}
            </button>
            <small className="location-privacy">Izin lokasi diperlukan. Koordinat tidak dikirim oleh CafeMatch ke server.</small>
            <button className="button button-primary location-done" onClick={() => setLocationDialog(false)} type="button">Selesai</button>
          </section>
        </div>
      )}

      {(detailLoading || detailError || detailPlace) && (
        <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) { setDetailPlace(null); setDetailError('') } }}>
          <section aria-labelledby="detail-title" aria-modal="true" className="detail-dialog" role="dialog">
            <button aria-label="Tutup detail kedai" className="dialog-close" onClick={() => { setDetailPlace(null); setDetailError('') }} type="button"><Icon>close</Icon></button>
            {detailLoading && <div className="loading-state"><span className="loading-mark"><Icon>coffee</Icon></span><strong>Memuat detail Google Maps...</strong></div>}
            {detailError && <p className="inline-error" role="alert">{detailError}</p>}
            {detailPlace && (
              <>
                <PhotoGallery place={detailPlace} />
                <span className="eyebrow">PROFIL TEMPAT · GOOGLE MAPS</span>
                <h2 id="detail-title">{detailPlace.name}</h2>
                <p className="detail-address">{detailPlace.address}</p>
                <div className="place-facts detail-facts">
                  <span className="place-rating"><Icon>star</Icon>{detailPlace.rating == null ? 'Belum ada rating' : detailPlace.rating.toFixed(1)}
                    {detailPlace.userRatingCount > 0 && <small>({detailPlace.userRatingCount.toLocaleString('id-ID')} ulasan)</small>}
                  </span>
                  <span className="price-label">{formatPrice(detailPlace)}</span>
                </div>
                {detailPlace.openingHours.length > 0 && (
                  <details className="hours-details">
                    <summary>Jam operasional Google Maps</summary>
                    {detailPlace.openingHours.map((hours) => <span key={hours}>{hours}</span>)}
                  </details>
                )}
                {detailPlace.phone && <p><a href={`tel:${detailPlace.phone}`}>{detailPlace.phone}</a></p>}
                {detailPlace.website && <p><a href={detailPlace.website} rel="noreferrer" target="_blank">{detailPlace.website}</a></p>}
                <div className="detail-actions">
                  <button className={`button ${favorites.includes(detailPlace.id) ? 'button-outline' : 'button-primary'}`} onClick={() => toggleFavorite(detailPlace)} type="button">
                    <Icon>{favorites.includes(detailPlace.id) ? 'favorite' : 'favorite_border'}</Icon>{favorites.includes(detailPlace.id) ? 'Tersimpan' : 'Simpan favorit'}
                  </button>
                  <button className="button button-outline" onClick={() => void sharePlace(detailPlace)} type="button"><Icon>share</Icon>Bagikan</button>
                  <a className="button button-primary" href={getPlaceLink(detailPlace)} rel="noreferrer" target="_blank"><Icon>near_me</Icon>Buka Google Maps</a>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {message && <div className="toast-message" role="status"><Icon>info</Icon>{message}</div>}
      <span className="sr-only" aria-live="polite">
        {view === 'favorites' ? `${savedPlaces.length} favorit dimuat.` : `${currentPlaceIds.size} tempat dari Google Maps tersedia.`}
      </span>
    </div>
  )
}

export default App
