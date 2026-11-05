import { useEffect, useMemo, useState } from 'react'
import {
  cafes,
  ambienceOptions,
  dataSource,
  defaultPreferences,
  districts,
  origins,
  radiusOptions,
} from './cafes.js'
import CafeMap from './CafeMap.jsx'
import { getCafeDataStatus, inferenceRules, recommendCafes } from './recommendation.js'
import './App.css'

const STORAGE_KEY = 'cafematch-semarang-expert-system-v2'

function readStore() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    const savedPreferences = saved.preferences && typeof saved.preferences === 'object'
      ? saved.preferences
      : {}
    return {
      preferences: {
        ...defaultPreferences,
        ...savedPreferences,
        originId: origins.some(({ id }) => id === savedPreferences.originId)
          ? savedPreferences.originId
          : defaultPreferences.originId,
        districtFilter: ['all', ...districts].includes(savedPreferences.districtFilter)
          ? savedPreferences.districtFilter
          : defaultPreferences.districtFilter,
        ambienceFilter: ambienceOptions.some(({ value }) => value === savedPreferences.ambienceFilter)
          ? savedPreferences.ambienceFilter
          : defaultPreferences.ambienceFilter,
        radiusKm: radiusOptions.includes(Number(savedPreferences.radiusKm))
          ? Number(savedPreferences.radiusKm)
          : defaultPreferences.radiusKm,
        requireWifi: typeof savedPreferences.requireWifi === 'boolean'
          ? savedPreferences.requireWifi
          : defaultPreferences.requireWifi,
        requireOutdoor: typeof savedPreferences.requireOutdoor === 'boolean'
          ? savedPreferences.requireOutdoor
          : defaultPreferences.requireOutdoor,
        prioritizeCoffee: typeof savedPreferences.prioritizeCoffee === 'boolean'
          ? savedPreferences.prioritizeCoffee
          : defaultPreferences.prioritizeCoffee,
        sortBy: ['recommendation', 'distance', 'wifi'].includes(savedPreferences.sortBy)
          ? savedPreferences.sortBy
          : defaultPreferences.sortBy,
      },
      favorites: Array.isArray(saved.favorites)
        ? saved.favorites.filter((id) => cafes.some((cafe) => cafe.id === id))
        : [],
    }
  } catch (error) {
    console.error('Gagal membaca data CafeMatch dari penyimpanan lokal.', error)
    return { preferences: defaultPreferences, favorites: [] }
  }
}

function SelectField({ label, onChange, options, value }) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function getCuisineLabel(cafe) {
  if (cafe.sourceUrl) return cafe.placeType || 'Tempat kopi dari sumber lokal'
  const category = cafe.category === 'shop=coffee' ? 'Kedai kopi' : 'Kafe (tag OSM)'
  if (!cafe.cuisine) return category
  return `${category} · ${cafe.cuisine
    .split(';')
    .map((item) => item.trim().replaceAll('_', ' '))
    .join(', ')}`
}

function getTrace(result, preferences, originLabel) {
  const firedRules = new Set(result.firedRules)
  return inferenceRules
    .filter((rule) => firedRules.has(rule.id))
    .map((rule) => {
      let explanation = rule.description
      if (rule.id === 'R2') {
        explanation = `${result.distanceKm.toFixed(1)} km dari ${originLabel}; termasuk radius ${preferences.radiusKm} km.`
      } else if (rule.id === 'R3') {
        explanation = preferences.requireWifi
          ? 'Wi-Fi tersedia tercatat pada data OpenStreetMap.'
          : 'Wi-Fi tidak dijadikan syarat konsultasi.'
      } else if (rule.id === 'R4') {
        explanation = preferences.requireOutdoor
          ? 'Area luar tersedia tercatat pada data OpenStreetMap.'
          : 'Area luar tidak dijadikan syarat konsultasi.'
      } else if (rule.id === 'R5') {
        const type = result.cuisine || result.category
        explanation = result.sourceName
          ? `Jenis tempat ngopi tercatat pada ${result.sourceName}.`
          : `Jenis coffee shop tercatat (${type}) di OpenStreetMap.`
      } else if (rule.id === 'R6') {
        explanation = preferences.districtFilter === 'all'
          ? 'Tidak ada filter kecamatan yang diterapkan.'
          : `Tempat tercatat di Kecamatan ${preferences.districtFilter}.`
      } else if (rule.id === 'R7') {
        explanation = preferences.ambienceFilter === 'all'
          ? 'Tidak ada filter suasana yang diterapkan.'
          : `Label suasana “${ambienceOptions.find(({ value }) => value === preferences.ambienceFilter)?.label}” ada di deskripsi sumber.`
      } else if (rule.id === 'R8') {
        explanation = 'Seluruh syarat wilayah, jarak, dan fasilitas yang diwajibkan terpenuhi.'
      } else if (rule.id === 'R9') {
        explanation = 'Kedai kopi yang teridentifikasi mendapat prioritas pada urutan hasil.'
      }
      return { ...rule, explanation }
    })
}

function getAmbienceLabels(cafe) {
  return (cafe.ambience || [])
    .map((ambience) => ambienceOptions.find(({ value }) => value === ambience)?.label)
    .filter(Boolean)
}

function CafeCard({ cafe, favorite, onToggleFavorite, originLabel, preferences, result }) {
  const distanceKm = result?.distanceKm
  const trace = result ? getTrace(result, preferences, originLabel) : []
  const recommendation = result?.facts.has('prioritizedCoffee')
    ? 'Prioritas kedai kopi'
    : result?.facts.has('coffeeShop')
      ? 'Jenis kedai kopi tercatat'
      : cafe.placeType === 'Angkringan'
        ? 'Angkringan cocok'
        : 'Kafe cocok'

  return (
    <article className="profile-card">
      <div className="profile-card-heading">
        <div>
          <span className="profile-tag">{result ? recommendation : 'Favorit tersimpan'}</span>
          <h3>{cafe.name}</h3>
        </div>
        <button
          aria-pressed={favorite}
          className={`favorite-button ${favorite ? 'saved' : ''}`}
          onClick={() => onToggleFavorite(cafe.id)}
          type="button"
        >{favorite ? 'Tersimpan' : 'Simpan kafe'}</button>
      </div>
      <div className="cafe-meta">
        <span>{distanceKm === undefined
          ? 'Jarak mengikuti titik konsultasi'
          : `${distanceKm.toFixed(1)} km dari ${originLabel === 'Lokasi saya' ? 'lokasi saya' : 'titik pilihan'}`}</span>
        <span>{cafe.district ? `Kecamatan ${cafe.district}` : 'Kecamatan belum ada data'}</span>
        <span>{getCuisineLabel(cafe)}</span>
        <span>Suasana: {getAmbienceLabels(cafe).join(', ') || 'belum ada label dari sumber'}</span>
      </div>
      <dl className="profile-facts">
        <div><dt>Alamat</dt><dd>{cafe.address || 'Belum ada data alamat'}</dd></div>
        {cafe.locationPrecision === 'approximate' && (
          <div><dt>Ketepatan lokasi</dt><dd>Perkiraan kawasan; jarak dan pin peta bisa kurang tepat.</dd></div>
        )}
        {cafe.locationPrecision === 'directory' && (
          <div><dt>Ketepatan lokasi</dt><dd>Titik lokasi dari halaman Direktori Kota Semarang.</dd></div>
        )}
        <div><dt>Wi-Fi</dt><dd>{getCafeDataStatus(cafe, 'wifi')}</dd></div>
        <div><dt>Area luar</dt><dd>{getCafeDataStatus(cafe, 'outdoor')}</dd></div>
        <div><dt>Jam buka</dt><dd>{cafe.openingHours || 'Belum ada data jam'}</dd></div>
      </dl>
      <div className="cafe-links">
        <a
          href={cafe.sourceUrl || `https://www.openstreetmap.org/${cafe.id}`}
          rel="noreferrer"
          target="_blank"
        >
          {cafe.sourceName ? `Lihat sumber: ${cafe.sourceName}` : 'Lihat sumber OpenStreetMap'}
        </a>
        {cafe.website && (
          <a href={cafe.website} rel="noreferrer" target="_blank">Situs yang tercatat</a>
        )}
      </div>
      {trace.length > 0 && (
        <details className="inference-trace">
          <summary>Jejak inferensi · {trace.length} aturan terpicu</summary>
          <ol>
            {trace.map((rule) => (
              <li key={rule.id}><strong>{rule.id} · {rule.name}</strong><span>{rule.explanation}</span></li>
            ))}
          </ol>
        </details>
      )}
    </article>
  )
}

function App() {
  const [store, setStore] = useState(readStore)
  const [userLocation, setUserLocation] = useState(null)
  const [view, setView] = useState('consult')
  const [hasConsulted, setHasConsulted] = useState(false)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [locationMessage, setLocationMessage] = useState('')
  const { preferences, favorites } = store
  const selectedOrigin = origins.find(({ id }) => id === preferences.originId) || origins[0]
  const origin = userLocation || selectedOrigin

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    } catch (error) {
      console.error('Gagal menyimpan data CafeMatch ke penyimpanan lokal.', error)
    }
  }, [store])

  const recommendations = useMemo(
    () => recommendCafes(cafes, origin, preferences),
    [origin, preferences],
  )
  const visibleRecommendations = recommendations.filter((cafe) => (
    cafe.name.toLocaleLowerCase('id').includes(search.trim().toLocaleLowerCase('id'))
  ))
  const favoriteCafes = cafes.filter((cafe) => favorites.includes(cafe.id))
  const activeFilterSummary = [
    `titik awal ${userLocation ? 'lokasi saya' : selectedOrigin.label}`,
    `radius ${preferences.radiusKm} km`,
    preferences.districtFilter === 'all' ? null : `kecamatan ${preferences.districtFilter}`,
    preferences.ambienceFilter === 'all'
      ? null
      : `suasana ${ambienceOptions.find(({ value }) => value === preferences.ambienceFilter)?.label || preferences.ambienceFilter}`,
    preferences.requireWifi ? 'Wi-Fi wajib tersedia' : null,
    preferences.requireOutdoor ? 'area luar wajib tersedia' : null,
  ].filter(Boolean).join(' · ')

  function updatePreferences(changes) {
    if ('originId' in changes) {
      setUserLocation(null)
      setLocationMessage('Menggunakan titik pilihan di Semarang.')
    }
    setStore((current) => ({
      ...current,
      preferences: { ...current.preferences, ...changes },
    }))
    setHasConsulted(false)
  }

  function showAllPlaces() {
    setUserLocation(null)
    setLocationMessage('Menggunakan titik pilihan di Semarang.')
    setStore((current) => ({ ...current, preferences: { ...defaultPreferences } }))
    setSearch('')
    setHasConsulted(true)
    setView('results')
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) {
      setLocationMessage('Browser ini tidak mendukung akses lokasi.')
      return
    }

    setLocationMessage('Meminta izin lokasi dari browser...')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({
          id: 'user-location',
          label: 'Lokasi saya',
          lat: coords.latitude,
          lng: coords.longitude,
        })
        setLocationMessage('Lokasi hanya digunakan di halaman ini dan tidak disimpan.')
      },
      (error) => {
        const messages = {
          1: 'Izin lokasi ditolak. Izinkan akses lokasi di pengaturan browser untuk mencoba lagi.',
          2: 'Lokasi tidak dapat ditentukan. Periksa layanan lokasi perangkat dan coba lagi.',
          3: 'Permintaan lokasi melewati batas waktu. Coba lagi.',
        }
        setLocationMessage(messages[error.code] || `Akses lokasi gagal: ${error.message}`)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  function resetLocation() {
    setUserLocation(null)
    setLocationMessage('Menggunakan titik pilihan di Semarang.')
  }

  function toggleFavorite(cafeId) {
    const saved = favorites.includes(cafeId)
    setStore((current) => ({
      ...current,
      favorites: saved
        ? current.favorites.filter((id) => id !== cafeId)
        : [...current.favorites, cafeId],
    }))
    setMessage(saved ? 'Kafe dihapus dari koleksi.' : 'Kafe disimpan di koleksi.')
    window.setTimeout(() => setMessage(''), 3000)
  }

  const navigation = [
    { id: 'consult', label: 'Konsultasi' },
    { id: 'results', label: 'Hasil rekomendasi', count: hasConsulted ? recommendations.length : 0 },
    { id: 'favorites', label: 'Koleksi saya', count: favorites.length },
    { id: 'logic', label: 'Basis aturan', count: inferenceRules.length },
  ]
  const locationMap = (
    <section aria-labelledby="map-heading" className="panel map-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">PETA KAFE & RADIUS</span>
          <h2 id="map-heading">Lihat lokasi di peta</h2>
        </div>
        <span className="count-pill">{recommendations.length} penanda</span>
      </div>
      <div className="map-actions">
        <button className="button button-outline" onClick={useDeviceLocation} type="button">
          Gunakan lokasi saya
        </button>
        {userLocation && (
          <button className="button button-outline" onClick={resetLocation} type="button">
            Kembali ke titik pilihan
          </button>
        )}
        <span aria-live="polite">{locationMessage || 'Izin lokasi hanya diminta setelah tombol ditekan.'}</span>
      </div>
      <CafeMap
        cafes={recommendations}
        center={origin}
        centerLabel={userLocation ? 'Lokasi saya' : selectedOrigin.label}
        radiusKm={preferences.radiusKm}
      />
      <div aria-label="Legenda peta" className="map-legend">
        <span><i className="map-legend-dot regular" />Tempat lainnya</span>
        <span><i className="map-legend-dot ngaliyan" />Tempat di Ngaliyan</span>
        <span><i className="map-legend-center" />Titik awal / lokasi saya</span>
      </div>
      <p className="map-disclosure">
        Peta memakai tile OpenStreetMap. Permintaan tile dikirim ke server peta; lokasi perangkat hanya diminta atas tindakanmu dan tetap diproses di browser.
      </p>
    </section>
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setView('consult') }}>
            <span className="brand-mark">CM</span>
            <span className="brand-copy">
              <span className="brand-name">CafeMatch</span>
              <span className="brand-caption">Sistem Pakar Kafe</span>
            </span>
          </a>
          <nav aria-label="Navigasi utama" className="side-nav">
            {navigation.map((item) => (
              <button
                aria-current={view === item.id ? 'page' : undefined}
                className={`nav-link ${view === item.id ? 'active' : ''}`}
                key={item.id}
                onClick={() => setView(item.id)}
                type="button"
              >
                <span>{item.label}</span>
                {item.count > 0 && <span className="nav-count">{item.count}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <p className="engine-status"><span className="status-dot" />Basis pengetahuan lokal · aktif</p>
          <div className="profile">
            <span className="avatar">SP</span>
            <span><strong>Mesin inferensi</strong><small>Forward chaining</small></span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div className="page-heading">
            <span className="eyebrow">SISTEM PAKAR · KAFE SEMARANG</span>
            <h1>{view === 'consult'
              ? 'Temukan kafe yang cocok'
              : view === 'results'
                ? 'Hasil konsultasi'
                : view === 'favorites'
                  ? 'Koleksi kafe'
                  : 'Cara kerja sistem pakar'}</h1>
            <p>{view === 'logic'
              ? 'Forward chaining mencocokkan fakta lokasi dan preferensi dengan atribut kafe yang tercatat.'
              : 'Pilih titik awal dan kebutuhanmu. Mesin inferensi menjelaskan alasan setiap hasil.'}</p>
          </div>
        </header>

        {view === 'consult' && (
          <div className="content-wrap">
            <section className="intro-panel">
              <span className="eyebrow">KONSULTASI LOKAL</span>
              <h2>Mulai dari kebutuhanmu.</h2>
              <p>Pilih titik awal, wilayah, dan batas jarak. Lokasi perangkat opsional; browser hanya meminta izin saat kamu menekan tombol.</p>
            </section>
            <section aria-labelledby="preferences-heading" className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">FAKTA PENGGUNA</span>
                  <h2 id="preferences-heading">Apa yang kamu butuhkan?</h2>
                </div>
                <span className="count-pill">{cafes.length} tempat terdaftar</span>
              </div>
              <div className="preference-grid">
                <SelectField
                  label="Titik awal"
                  onChange={(originId) => updatePreferences({ originId })}
                  options={origins.map(({ id, label }) => ({ value: id, label }))}
                  value={preferences.originId}
                />
                <SelectField
                  label="Wilayah kafe"
                  onChange={(districtFilter) => updatePreferences({ districtFilter })}
                  options={[
                    { value: 'all', label: 'Semua wilayah Semarang' },
                    ...districts.map((district) => ({ value: district, label: district })),
                  ]}
                  value={preferences.districtFilter}
                />
                <SelectField
                  label="Suasana"
                  onChange={(ambienceFilter) => updatePreferences({ ambienceFilter })}
                  options={ambienceOptions}
                  value={preferences.ambienceFilter}
                />
                <SelectField
                  label="Jarak maksimal"
                  onChange={(radius) => updatePreferences({ radiusKm: Number(radius) })}
                  options={radiusOptions.map((radius) => ({ value: radius, label: `${radius} km` }))}
                  value={preferences.radiusKm}
                />
                <SelectField
                  label="Urutkan hasil"
                  onChange={(sortBy) => updatePreferences({ sortBy })}
                  options={[
                    { value: 'recommendation', label: 'Kecocokan sistem' },
                    { value: 'distance', label: 'Jarak terdekat' },
                    { value: 'wifi', label: 'Wi-Fi tercatat tersedia' },
                  ]}
                  value={preferences.sortBy}
                />
                <label className="toggle-row">
                  <span><strong>Wi-Fi wajib tercatat tersedia</strong><small>Data yang belum diketahui tidak dianggap tersedia.</small></span>
                  <input checked={preferences.requireWifi} onChange={(event) => updatePreferences({ requireWifi: event.target.checked })} type="checkbox" />
                </label>
                <label className="toggle-row">
                  <span><strong>Area luar wajib tercatat tersedia</strong><small>Data yang belum diketahui tidak dianggap tersedia.</small></span>
                  <input checked={preferences.requireOutdoor} onChange={(event) => updatePreferences({ requireOutdoor: event.target.checked })} type="checkbox" />
                </label>
                <label className="toggle-row">
                  <span><strong>Prioritaskan kedai kopi</strong><small>Hanya jika jenis coffee shop tercatat.</small></span>
                  <input checked={preferences.prioritizeCoffee} onChange={(event) => updatePreferences({ prioritizeCoffee: event.target.checked })} type="checkbox" />
                </label>
              </div>
              <div className="consult-actions">
                <button className="button button-primary" onClick={() => { setHasConsulted(true); setView('results') }} type="button">
                  Proses konsultasi
                </button>
                <span>Aturan dan jarak diproses di browser. Peta dasar memakai tile OpenStreetMap.</span>
              </div>
            </section>
            {locationMap}
            <p className="data-notice">
              <strong>Sumber dan batasan data:</strong> {dataSource.osmCafeCount} tempat bertag kafe/kopi dari OpenStreetMap, {dataSource.cityDirectorySourceCount} listing berkategori coffee shop dari Direktori Kota Semarang, tempat Ngaliyan dari SemarangBawah, dan {dataSource.googleMapsCafeCount} listing kedai kopi dari Google Maps; data diambil {dataSource.retrievedAt}. Data kecamatan mengikuti lokasi yang dicantumkan sumber. Suasana hanya ditandai jika disebut dalam deskripsi sumber; tempat tanpa label tidak akan muncul saat suasana tertentu dipilih. Pin perkiraan kawasan ditandai pada kartu. © OpenStreetMap contributors; lisensi ODbL 1.0; <a href={dataSource.attributionUrl} rel="noreferrer" target="_blank">detail atribusi</a>.
            </p>
          </div>
        )}

        {view === 'results' && (
          <div className="content-wrap">
            {!hasConsulted ? (
              <div className="empty-state">
                <h2>Belum ada hasil konsultasi</h2>
                <p>Pilih preferensi terlebih dahulu agar mesin inferensi dapat memproses fakta.</p>
                <button className="button button-primary" onClick={() => setView('consult')} type="button">Mulai konsultasi</button>
              </div>
            ) : (
              <>
                <section className="results-toolbar">
                  <div>
                    <span className="eyebrow">HASIL FORWARD CHAINING</span>
                    <h2>{visibleRecommendations.length} dari {recommendations.length} tempat cocok</h2>
                  </div>
                  <button className="button button-outline" onClick={() => setView('consult')} type="button">Ubah kebutuhan</button>
                </section>
                <label className="search-field">
                  <span>Cari nama tempat</span>
                  <input onChange={(event) => setSearch(event.target.value)} placeholder="Ketik nama tempat..." type="search" value={search} />
                </label>
                {locationMap}
                {visibleRecommendations.length > 0 ? (
                  <div className="profile-list">
                    {visibleRecommendations.map((cafe) => (
                      <CafeCard
                        cafe={cafe}
                        favorite={favorites.includes(cafe.id)}
                        key={cafe.id}
                        onToggleFavorite={toggleFavorite}
                        originLabel={userLocation ? 'Lokasi saya' : selectedOrigin.label}
                        preferences={preferences}
                        result={cafe}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <h2>Tidak ada tempat yang cocok</h2>
                    {recommendations.length ? (
                      <p>Tidak ada nama kafe yang cocok dengan pencarian. Coba kata kunci lain.</p>
                    ) : (
                      <>
                        <p>Belum ada data yang memenuhi semua syarat. Filter yang tersimpan mungkin terlalu spesifik:</p>
                        <p><strong>Filter aktif:</strong> {activeFilterSummary}.</p>
                      </>
                    )}
                    <div className="empty-state-actions">
                      {!recommendations.length && (
                        <button className="button button-primary" onClick={showAllPlaces} type="button">
                          Tampilkan semua {cafes.length} tempat
                        </button>
                      )}
                      <button
                        className={`button ${recommendations.length ? 'button-primary' : 'button-outline'}`}
                        onClick={() => setView('consult')}
                        type="button"
                      >Ubah kebutuhan</button>
                    </div>
                  </div>
                )}
                <p className="data-notice">
                  Data OpenStreetMap © <a href={dataSource.attributionUrl} rel="noreferrer" target="_blank">OpenStreetMap contributors</a>, lisensi ODbL 1.0. Tempat tambahan bersumber dari Direktori Kota Semarang, SemarangBawah, dan Google Maps; sumber masing-masing tersedia pada kartu. Informasi dapat berubah; periksa sumber sebelum berkunjung.
                </p>
              </>
            )}
          </div>
        )}

        {view === 'favorites' && (
          <div className="content-wrap">
            <section className="results-toolbar">
              <div>
                <span className="eyebrow">TERSIMPAN DI PERANGKAT</span>
                <h2>{favoriteCafes.length} tempat disimpan</h2>
              </div>
            </section>
            {favoriteCafes.length ? (
              <div className="profile-list">
                {favoriteCafes.map((cafe) => (
                  <CafeCard
                    cafe={cafe}
                    favorite
                    key={cafe.id}
                    onToggleFavorite={toggleFavorite}
                    preferences={preferences}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h2>Belum ada kafe tersimpan</h2>
                <p>Simpan kafe dari hasil konsultasi untuk membukanya kembali di sini.</p>
                <button className="button button-primary" onClick={() => setView('consult')} type="button">Mulai konsultasi</button>
              </div>
            )}
          </div>
        )}

        {view === 'logic' && (
          <div className="content-wrap">
            <section className="intro-panel">
              <span className="eyebrow">METODE FORWARD CHAINING</span>
              <h2>Fakta menjadi rekomendasi.</h2>
              <p>Fakta awal berasal dari titik pilihan, jarak hasil perhitungan, kebutuhan fasilitas, dan tag kafe di basis pengetahuan. Mesin memeriksa aturan hingga tidak ada fakta baru. Atribut fasilitas yang tidak diketahui tidak digunakan sebagai bukti tersedia.</p>
            </section>
            <div className="rule-list">
              {inferenceRules.map((rule) => (
                <article className="rule-item" key={rule.id}>
                  <span className="rule-id">{rule.id}</span>
                  <div>
                    <h3>{rule.name}</h3>
                    <p>{rule.description}</p>
                  </div>
                </article>
              ))}
            </div>
            <p className="data-notice">
              Basis pengetahuan memuat {dataSource.osmCafeCount} tempat dari OpenStreetMap, {dataSource.cityDirectoryCafeCount} listing tambahan unik dari Direktori Kota Semarang, {dataSource.additionalNgaliyanCafeCount} listing Ngaliyan, dan {dataSource.googleMapsCafeCount} tempat dari Google Maps. Total {dataSource.totalPlaceCount} tempat dari {districts.length} kecamatan. Suasana ditandai hanya jika disebut dalam deskripsi sumber. © <a href={dataSource.attributionUrl} rel="noreferrer" target="_blank">OpenStreetMap contributors</a>, lisensi ODbL 1.0.
            </p>
          </div>
        )}
        <footer className="page-footer">
          <span>CafeMatch · Sistem pakar lokal · {cafes.length} tempat</span>
          <a href="/privacy.html">Kebijakan Privasi</a>
          <a href="/terms.html">Ketentuan Penggunaan</a>
        </footer>
      </main>

      {message && <div className="toast" role="status">{message}</div>}
    </div>
  )
}

export default App
