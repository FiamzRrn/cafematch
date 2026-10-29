import { getPriceLevel } from './cafes.js'

export function distanceInKm(from, to) {
  const radians = (degrees) => degrees * Math.PI / 180
  const latitudeDifference = radians(to.lat - from.lat)
  const longitudeDifference = radians(to.lng - from.lng)
  const fromLatitude = radians(from.lat)
  const toLatitude = radians(to.lat)
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDifference / 2) ** 2

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export function calculatePlaceScore(place, origin, preferences) {
  const distance = distanceInKm(origin, place)
  const withinRadius = distance <= preferences.radiusKm
  const breakdown = {
    rating: place.rating == null ? 0 : place.rating / 5 * 50,
    reviews: Math.min(15, Math.log10(place.userRatingCount + 1) / 3 * 15),
    currentHours: place.openNow === true ? 15 : 0,
    proximity: withinRadius
      ? 18 * Math.max(0, 1 - distance / preferences.radiusKm)
      : 0,
  }

  return {
    distance,
    withinRadius,
    breakdown,
    score: Math.round(Object.values(breakdown).reduce((total, points) => total + points, 0)),
  }
}

export function rankPlaces(places, origin, preferences, sortBy = 'match') {
  const results = places
    .map((place) => ({ place, ...calculatePlaceScore(place, origin, preferences) }))
    .filter(({ place, distance }) => distance <= preferences.radiusKm
      && (preferences.minRating === 0 || (place.rating ?? 0) >= preferences.minRating)
      && (preferences.maxPriceLevel === 0 || getPriceLevel(place) <= preferences.maxPriceLevel)
      && (!preferences.openNow || place.openNow === true))

  return results.sort((a, b) => {
    if (sortBy === 'distance') return a.distance - b.distance
    if (sortBy === 'rating') return (b.place.rating ?? -1) - (a.place.rating ?? -1)
      || b.place.userRatingCount - a.place.userRatingCount
      || a.distance - b.distance
    if (sortBy === 'reviews') return b.place.userRatingCount - a.place.userRatingCount
      || (b.place.rating ?? -1) - (a.place.rating ?? -1)
      || a.distance - b.distance
    return b.score - a.score
      || (b.place.rating ?? -1) - (a.place.rating ?? -1)
      || a.distance - b.distance
  })
}
