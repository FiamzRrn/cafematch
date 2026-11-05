import test from 'node:test'
import assert from 'node:assert/strict'
import {
  additionalNgaliyanCafes,
  ambienceOptions,
  cafes,
  dataSource,
  defaultPreferences,
  districts,
  origins,
  osmCafes,
} from '../src/cafes.js'
import { cityDirectoryCafes } from '../src/cityDirectoryCafes.js'
import { googleMapsCafes } from '../src/googleMapsCafes.js'
import { distanceInKm, inferenceRules, recommendCafes } from '../src/recommendation.js'

const origin = origins.find(({ id }) => id === defaultPreferences.originId)
const expectedDistricts = [
  'Banyumanik',
  'Candisari',
  'Gajahmungkur',
  'Gayamsari',
  'Genuk',
  'Gunungpati',
  'Mijen',
  'Ngaliyan',
  'Pedurungan',
  'Semarang Barat',
  'Semarang Selatan',
  'Semarang Tengah',
  'Semarang Timur',
  'Semarang Utara',
  'Tembalang',
  'Tugu',
]

test('knowledge base contains unique OSM, directory, Ngaliyan, and Google Maps entries', () => {
  const ids = cafes.map(({ id }) => id)
  const osmIds = osmCafes.map(({ id }) => id)

  assert.equal(cafes.length, 163)
  assert.equal(osmCafes.length, 67)
  assert.equal(cityDirectoryCafes.length, 64)
  assert.equal(additionalNgaliyanCafes.length, 11)
  assert.equal(googleMapsCafes.length, 21)
  assert.equal(new Set(ids).size, cafes.length)
  assert.ok(osmIds.every((id) => /^(node|way)\/\d+$/.test(id)))
  assert.ok(osmCafes.every(({ category }) => category === 'amenity=cafe' || category === 'shop=coffee'))
  assert.ok(osmCafes.every(({ district }) => district))
  assert.ok(additionalNgaliyanCafes.every(({ sourceUrl, district }) => sourceUrl && district === 'Ngaliyan'))
  assert.ok(cityDirectoryCafes.every(({ sourceUrl, district, coffeeRelated }) => sourceUrl && district && coffeeRelated))
  assert.ok(googleMapsCafes.every(({ sourceUrl, sourceName, district, coffeeRelated }) => (
    sourceUrl && sourceName === 'Google Maps' && district && coffeeRelated
  )))
  assert.ok(googleMapsCafes.every(({ sourceUrl }) => (
    sourceUrl.startsWith('https://www.google.com/maps/search/') && !sourceUrl.includes('api=')
  )))
  assert.equal(dataSource.queryArea, 'Kota Semarang')
  assert.equal(dataSource.license, 'Open Database License (ODbL) 1.0')
  assert.equal(dataSource.sourceObjectCount - dataSource.excludedDuplicateCount, osmCafes.length)
  assert.equal(dataSource.osmCafeCount, osmCafes.length)
  assert.equal(dataSource.cityDirectorySourceCount, 72)
  assert.equal(dataSource.cityDirectoryDuplicateCount, 8)
  assert.equal(dataSource.cityDirectoryCafeCount, cityDirectoryCafes.length)
  assert.equal(dataSource.additionalNgaliyanCafeCount, additionalNgaliyanCafes.length)
  assert.equal(dataSource.googleMapsCafeCount, googleMapsCafes.length)
  assert.equal(dataSource.totalPlaceCount, cafes.length)
  assert.equal(dataSource.ngaliyanRelationId, 'relation/8409086')
  assert.ok(cafes.every(({ lat, lng }) => lat > -7.2 && lat < -6.8 && lng > 110 && lng < 111))
  assert.deepEqual([...districts].sort((a, b) => a.localeCompare(b, 'id')), expectedDistricts)
  assert.ok(cafes.every(({ district }) => expectedDistricts.includes(district)))
  assert.ok(ambienceOptions.some(({ value }) => value === 'view'))
})

test('forward chaining returns only entries inside the selected radius', () => {
  const results = recommendCafes(cafes, origin, { ...defaultPreferences, radiusKm: 3 })

  assert.ok(results.length > 0)
  assert.ok(results.every(({ distanceKm, facts }) => distanceKm <= 3 && facts.has('candidate')))
  assert.ok(results.every(({ firedRules }) => firedRules.includes('R1') && firedRules.includes('R8')))
})

test('required amenities exclude unknown or explicitly unavailable data', () => {
  const fixtures = [
    { id: 'node/1', name: 'Wi-Fi tersedia', lat: origin.lat, lng: origin.lng, wifi: 'wlan', outdoor: 'yes' },
    { id: 'node/2', name: 'Wi-Fi tidak diketahui', lat: origin.lat, lng: origin.lng, outdoor: 'yes' },
    { id: 'node/3', name: 'Wi-Fi tidak tersedia', lat: origin.lat, lng: origin.lng, wifi: 'no', outdoor: 'yes' },
    { id: 'node/4', name: 'Area luar tidak diketahui', lat: origin.lat, lng: origin.lng, wifi: 'yes' },
    { id: 'node/5', name: 'Area luar tidak tersedia', lat: origin.lat, lng: origin.lng, wifi: 'yes', outdoor: 'no' },
  ]
  const results = recommendCafes(fixtures, origin, {
    ...defaultPreferences,
    radiusKm: 3,
    requireWifi: true,
    requireOutdoor: true,
  })

  assert.deepEqual(results.map(({ id }) => id), ['node/1'])
})

test('unknown amenities are not treated as unavailable when not required', () => {
  const fixture = { id: 'node/1', name: 'Kafe tanpa data fasilitas', lat: origin.lat, lng: origin.lng }
  const results = recommendCafes([fixture], origin, { ...defaultPreferences, radiusKm: 3 })

  assert.equal(results.length, 1)
  assert.equal(results[0].wifi, undefined)
  assert.equal(results[0].outdoor, undefined)
  assert.equal(results[0].facts.has('candidate'), true)
})

test('Ngaliyan district filter includes the OSM cafes and additional sourced listings', () => {
  const results = recommendCafes(cafes, origins.find(({ id }) => id === 'ngaliyan'), {
    ...defaultPreferences,
    districtFilter: 'Ngaliyan',
  })

  assert.equal(results.length, 13)
  assert.deepEqual(results.map(({ name }) => name).sort(), [
    'ARD Cafe & View',
    'Angkringan Saroengan (ANGSA)',
    'Folkafe Ngaliyan',
    'Fore Coffee',
    'Gematik Kopi',
    'Kairos Coffee',
    'Kopi Nuri Ngaliyan',
    'Marview Cafetaria',
    'Noms Kopi Ngaliyan',
    'Saroengan Cafe',
    'Semilir Cafe City Light',
    'Sora Kafe',
    'Wardana Kopi View Laut',
  ])
  assert.ok(results.every(({ district, firedRules }) => district === 'Ngaliyan' && firedRules.includes('R6') && firedRules.includes('R8')))
  assert.equal(dataSource.ngaliyanPlaceCount, results.length)
})

test('district filter returns sourced places in all 16 Semarang districts', () => {
  for (const district of expectedDistricts) {
    const results = recommendCafes(cafes, origin, {
      ...defaultPreferences,
      districtFilter: district,
    })

    assert.ok(results.length > 0, `Expected at least one listing in ${district}`)
    assert.ok(results.every(({ district: resultDistrict }) => resultDistrict === district))
  }
})

test('ambience filter only returns places explicitly tagged by a source description', () => {
  const results = recommendCafes(cafes, origin, {
    ...defaultPreferences,
    ambienceFilter: 'view',
  })

  assert.ok(results.length > 0)
  assert.ok(results.every(({ ambience, firedRules }) => (
    ambience.includes('view') && firedRules.includes('R7') && firedRules.includes('R8')
  )))

  const unclassified = { id: 'node/999', name: 'Tempat tanpa deskripsi suasana', lat: origin.lat, lng: origin.lng }
  assert.deepEqual(recommendCafes([unclassified], origin, {
    ...defaultPreferences,
    ambienceFilter: 'view',
  }), [])
})

test('additional listings identify approximate map locations instead of implying exact coordinates', () => {
  const approximate = additionalNgaliyanCafes.filter(({ locationPrecision }) => locationPrecision === 'approximate')

  assert.deepEqual(approximate.map(({ name }) => name).sort(), [
    'Folkafe Ngaliyan',
    'Kopi Nuri Ngaliyan',
    'Noms Kopi Ngaliyan',
    'Sora Kafe',
    'Wardana Kopi View Laut',
  ])
})

test('prioritizes only cafes explicitly tagged as coffee shops', () => {
  const fixtures = [
    { id: 'node/1', name: 'Kafe tanpa jenis', lat: origin.lat, lng: origin.lng },
    { id: 'node/2', name: 'Kedai kopi', lat: origin.lat + 0.01, lng: origin.lng, cuisine: 'regional;coffee_shop' },
    { id: 'node/3', name: 'Toko kopi', lat: origin.lat + 0.02, lng: origin.lng, category: 'shop=coffee' },
  ]
  const results = recommendCafes(fixtures, origin, {
    ...defaultPreferences,
    radiusKm: 3,
  })

  assert.deepEqual(results.map(({ id }) => id), ['node/2', 'node/3', 'node/1'])
  assert.equal(results[0].facts.has('prioritizedCoffee'), true)
  assert.equal(results[1].facts.has('prioritizedCoffee'), true)
  assert.equal(results[2].facts.has('prioritizedCoffee'), false)
})

test('distance calculation returns the expected approximate distance', () => {
  const distance = distanceInKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })

  assert.ok(distance > 110 && distance < 112)
})

test('each forward-chaining rule has an identifier, explanation, and executable condition', () => {
  assert.equal(inferenceRules.length, 9)
  assert.ok(inferenceRules.every(({ id, name, description, apply }) => id && name && description && typeof apply === 'function'))
})
