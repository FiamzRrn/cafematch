import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePlaceScore, distanceInKm, rankPlaces } from '../src/recommendation.js'
import { defaultPreferences, origins } from '../src/cafes.js'
import { normalizePlace, searchSemarangCafes } from '../src/googleMaps.js'

const origin = origins[0]

const nearbyCafe = {
  id: 'semarang-cafe',
  name: 'Kedai Uji',
  lat: origin.lat,
  lng: origin.lng,
  rating: 5,
  userRatingCount: 999,
  priceLevel: 'PRICE_LEVEL_MODERATE',
  openNow: true,
}

test('distance is zero at the same coordinate and valid between Semarang anchors', () => {
  assert.equal(distanceInKm(origin, origin), 0)
  assert.ok(distanceInKm(origin, origins.find(({ id }) => id === 'tembalang')) > 5)
  assert.ok(distanceInKm(origin, origins.find(({ id }) => id === 'tembalang')) < 10)
})

test('transparent recommendation weights total 98 points at the origin', () => {
  const score = calculatePlaceScore(nearbyCafe, origin, defaultPreferences)

  assert.deepEqual(score.breakdown, { rating: 50, reviews: 15, currentHours: 15, proximity: 18 })
  assert.equal(score.score, 98)
})

test('Google Maps rating, review count, opening state, price, radius, and sort filters work', () => {
  const cafes = [
    { ...nearbyCafe, id: 'popular', userRatingCount: 100 },
    { ...nearbyCafe, id: 'quiet', lat: origin.lat + 0.02, rating: 4.2, userRatingCount: 8, openNow: false },
    { ...nearbyCafe, id: 'far', lat: origin.lat + 1 },
    { ...nearbyCafe, id: 'expensive', priceLevel: 'PRICE_LEVEL_VERY_EXPENSIVE' },
  ]
  const preferences = { ...defaultPreferences, radiusKm: 5, maxPriceLevel: 4 }
  const ranked = rankPlaces(cafes, origin, preferences)

  assert.deepEqual(ranked.map(({ place }) => place.id), ['popular', 'quiet'])
  assert.ok(ranked[0].score >= ranked[1].score)
  assert.deepEqual(
    rankPlaces(cafes, origin, { ...preferences, openNow: true }).map(({ place }) => place.id),
    ['popular'],
  )
  assert.deepEqual(
    rankPlaces(cafes, origin, { ...preferences, minRating: 4.5 }).map(({ place }) => place.id),
    ['popular'],
  )
  assert.deepEqual(
    rankPlaces(cafes, origin, preferences, 'distance').map(({ place }) => place.id),
    ['popular', 'quiet'],
  )
})

test('places without Google rating receive no invented rating points', () => {
  const result = calculatePlaceScore({ ...nearbyCafe, rating: null, userRatingCount: 0 }, origin, defaultPreferences)

  assert.equal(result.breakdown.rating, 0)
  assert.equal(result.breakdown.reviews, 0)
})

test('normalized Google Places data exposes coordinates, price, contact details, and photo attribution', () => {
  const place = normalizePlace({
    id: 'place-123',
    displayName: { text: 'Kedai Uji' },
    formattedAddress: 'Semarang, Jawa Tengah',
    location: { toJSON: () => ({ lat: origin.lat, lng: origin.lng }) },
    rating: 4.7,
    userRatingCount: 45,
    priceLevel: 'PRICE_LEVEL_INEXPENSIVE',
    nationalPhoneNumber: '+62 24 123456',
    websiteURI: 'https://example.test',
    regularOpeningHours: { weekdayDescriptions: ['Senin: 08.00–22.00'] },
    isOpen: () => true,
    photos: [{
      getURI: () => 'https://example.test/photo',
      authorAttributions: [{ displayName: 'Kontributor', uri: 'https://example.test/profile' }],
    }],
  })

  assert.equal(place.lat, origin.lat)
  assert.equal(place.lng, origin.lng)
  assert.equal(place.priceLevel, 'PRICE_LEVEL_INEXPENSIVE')
  assert.equal(place.openNow, true)
  assert.equal(place.phone, '+62 24 123456')
  assert.equal(place.website, 'https://example.test')
  assert.deepEqual(place.photos[0].attributions, [{ name: 'Kontributor', url: 'https://example.test/profile' }])
})

test('failed area searches are returned rather than treated as an empty successful result', async () => {
  const progress = []
  const result = await searchSemarangCafes({
    searchNearby: async () => {
      throw new Error('API unavailable')
    },
  }, (state) => progress.push(state))

  assert.equal(result.places.length, 0)
  assert.equal(result.failedAreas.length, result.searchedAreas)
  assert.equal(progress.length, result.searchedAreas)
  assert.equal(progress.at(-1).completed, result.searchedAreas)
})

test('Semarang Places searches use coffee categories, bounded result counts, and deduplicate by Place ID', async () => {
  const requests = []
  const result = await searchSemarangCafes({
    searchNearby: async (request) => {
      requests.push(request)
      return {
        places: [
          { id: 'shared-place', businessStatus: 'OPERATIONAL' },
          { id: `place-${requests.length}`, businessStatus: 'OPERATIONAL' },
        ],
      }
    },
  })

  assert.equal(requests.length, result.searchedAreas)
  assert.equal(result.failedAreas.length, 0)
  assert.equal(result.places.length, result.searchedAreas + 1)
  assert.deepEqual(requests[0].includedTypes, ['cafe', 'coffee_shop'])
  assert.equal(requests[0].maxResultCount, 20)
  assert.equal(requests[0].locationRestriction.circle.radius, 4200)
})
