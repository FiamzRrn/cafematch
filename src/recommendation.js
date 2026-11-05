const hasFact = (facts, fact) => facts.has(fact)

const derive = (facts, condition, conclusion) => {
  if (!condition || hasFact(facts, conclusion)) return false
  facts.add(conclusion)
  return true
}

export const inferenceRules = [
  {
    id: 'R1',
    name: 'Validasi wilayah',
    description: 'Data kafe tercatat di dalam batas Kota Semarang.',
    apply: (facts) => derive(facts, hasFact(facts, 'inSemarang'), 'areaVerified'),
  },
  {
    id: 'R2',
    name: 'Pemeriksaan jarak',
    description: 'Jarak dari titik pilihan berada dalam radius yang ditentukan.',
    apply: (facts) => derive(facts, hasFact(facts, 'withinRadius'), 'inRange'),
  },
  {
    id: 'R3',
    name: 'Kecocokan Wi-Fi',
    description: 'Wi-Fi tersedia jika diminta, atau preferensi Wi-Fi tidak diwajibkan.',
    apply: (facts) => derive(facts, !hasFact(facts, 'requireWifi') || hasFact(facts, 'wifiAvailable'), 'wifiAccepted'),
  },
  {
    id: 'R4',
    name: 'Kecocokan area luar',
    description: 'Area luar tersedia jika diminta, atau preferensi area luar tidak diwajibkan.',
    apply: (facts) => derive(facts, !hasFact(facts, 'requireOutdoor') || hasFact(facts, 'outdoorAvailable'), 'outdoorAccepted'),
  },
  {
    id: 'R5',
    name: 'Identifikasi kedai kopi',
    description: 'Jenis coffee shop dikenali dari tag OpenStreetMap atau klasifikasi sumber lokal.',
    apply: (facts) => derive(facts, hasFact(facts, 'coffeeShopTagged'), 'coffeeShop'),
  },
  {
    id: 'R6',
    name: 'Kecocokan kecamatan',
    description: 'Tempat berada di kecamatan yang dipilih, atau tidak ada filter kecamatan.',
    apply: (facts) => derive(
      facts,
      !hasFact(facts, 'requireDistrict') || hasFact(facts, 'inSelectedDistrict'),
      'districtAccepted',
    ),
  },
  {
    id: 'R7',
    name: 'Kecocokan suasana',
    description: 'Suasana cocok dengan pilihan berdasarkan deskripsi sumber, atau tidak ada filter suasana.',
    apply: (facts) => derive(
      facts,
      !hasFact(facts, 'requireAmbience') || hasFact(facts, 'ambienceMatches'),
      'ambienceAccepted',
    ),
  },
  {
    id: 'R8',
    name: 'Penetapan kandidat',
    description: 'Tempat berada di Semarang dan radius, serta memenuhi seluruh filter yang diwajibkan.',
    apply: (facts) => derive(
      facts,
      hasFact(facts, 'areaVerified')
        && hasFact(facts, 'inRange')
        && hasFact(facts, 'wifiAccepted')
        && hasFact(facts, 'outdoorAccepted')
        && hasFact(facts, 'districtAccepted')
        && hasFact(facts, 'ambienceAccepted'),
      'candidate',
    ),
  },
  {
    id: 'R9',
    name: 'Prioritas kedai kopi',
    description: 'Kandidat diberi prioritas karena sumber mencatatnya sebagai tempat kopi.',
    apply: (facts) => derive(
      facts,
      hasFact(facts, 'candidate') && hasFact(facts, 'coffeeShop') && hasFact(facts, 'prioritizeCoffee'),
      'prioritizedCoffee',
    ),
  },
]

export function distanceInKm(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180
  const latDifference = radians(to.lat - from.lat)
  const lngDifference = radians(to.lng - from.lng)
  const a = Math.sin(latDifference / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(lngDifference / 2) ** 2

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getFacts(cafe, distanceKm, preferences) {
  const cuisine = cafe.cuisine?.split(';').map((item) => item.trim()) ?? []
  const facts = new Set(['inSemarang'])

  if (distanceKm <= preferences.radiusKm) facts.add('withinRadius')
  if (cafe.wifi === 'yes' || cafe.wifi === 'wlan') facts.add('wifiAvailable')
  if (cafe.outdoor === 'yes') facts.add('outdoorAvailable')
  if (
    cuisine.includes('coffee_shop')
    || cafe.category === 'shop=coffee'
    || cafe.coffeeRelated === true
  ) facts.add('coffeeShopTagged')
  if (preferences.requireWifi) facts.add('requireWifi')
  if (preferences.requireOutdoor) facts.add('requireOutdoor')
  if (preferences.districtFilter && preferences.districtFilter !== 'all') {
    facts.add('requireDistrict')
    if (cafe.district === preferences.districtFilter) facts.add('inSelectedDistrict')
  }
  const ambienceFilter = preferences.ambienceFilter || 'all'
  if (ambienceFilter !== 'all') {
    facts.add('requireAmbience')
    if (cafe.ambience?.includes(ambienceFilter)) facts.add('ambienceMatches')
  }
  if (preferences.prioritizeCoffee) facts.add('prioritizeCoffee')

  return facts
}

function inferCafe(cafe, distanceKm, preferences) {
  const facts = getFacts(cafe, distanceKm, preferences)
  const firedRules = []
  let changed = true

  while (changed) {
    changed = false
    for (const rule of inferenceRules) {
      if (rule.apply(facts)) {
        firedRules.push(rule.id)
        changed = true
      }
    }
  }

  return { facts, firedRules }
}

export function recommendCafes(cafes, origin, preferences) {
  if (!origin) return []

  const matches = cafes
    .map((cafe) => {
      const distanceKm = distanceInKm(origin, cafe)
      const { facts, firedRules } = inferCafe(cafe, distanceKm, preferences)
      return { ...cafe, distanceKm, facts, firedRules }
    })
    .filter((cafe) => cafe.facts.has('candidate'))

  matches.sort((a, b) => {
    if (preferences.sortBy === 'distance') return a.distanceKm - b.distanceKm
    if (preferences.sortBy === 'wifi') {
      const wifiDifference = Number(b.wifi === 'yes' || b.wifi === 'wlan') - Number(a.wifi === 'yes' || a.wifi === 'wlan')
      return wifiDifference || a.distanceKm - b.distanceKm
    }

    const priorityDifference = Number(b.facts.has('prioritizedCoffee')) - Number(a.facts.has('prioritizedCoffee'))
    return priorityDifference || a.distanceKm - b.distanceKm
  })

  return matches
}

export function getCafeDataStatus(cafe, key) {
  if (key === 'wifi') {
    if (cafe.wifi === 'yes' || cafe.wifi === 'wlan') return 'Tercatat tersedia'
    if (cafe.wifi === 'no') return 'Tercatat tidak tersedia'
    return 'Belum ada data'
  }
  if (key === 'outdoor') {
    if (cafe.outdoor === 'yes') return 'Tercatat tersedia'
    if (cafe.outdoor === 'no') return 'Tercatat tidak tersedia'
    return 'Belum ada data'
  }
  return cafe[key] || 'Belum ada data'
}
