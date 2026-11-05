import { useEffect } from 'react'
import { ambienceOptions } from './cafes.js'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

function MapViewport({ center, radiusKm }) {
  const map = useMap()

  useEffect(() => {
    const latitudeDelta = radiusKm / 111
    const longitudeDelta = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180))
    map.fitBounds([
      [center.lat - latitudeDelta, center.lng - longitudeDelta],
      [center.lat + latitudeDelta, center.lng + longitudeDelta],
    ], { padding: [20, 20], maxZoom: 13, animate: false })
  }, [center.lat, center.lng, map, radiusKm])

  return null
}

function CafeMap({ cafes, center, centerLabel, radiusKm }) {
  const mapCenter = [center.lat, center.lng]

  return (
    <div className="map-frame">
      <MapContainer
        center={mapCenter}
        className="cafe-map"
        scrollWheelZoom
        zoom={12}
      >
        <MapViewport center={center} radiusKm={radiusKm} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          maxZoom={19}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={mapCenter}
          pathOptions={{ color: '#97472e', fillColor: '#bd876b', fillOpacity: 0.1, weight: 2 }}
          radius={radiusKm * 1000}
        >
          <Popup>Radius pencarian {radiusKm} km dari {centerLabel}.</Popup>
        </Circle>
        <CircleMarker
          center={mapCenter}
          pathOptions={{ color: '#fff', fillColor: '#97472e', fillOpacity: 1, weight: 3 }}
          radius={8}
        >
          <Popup>{centerLabel}</Popup>
        </CircleMarker>
        {cafes.map((cafe) => (
          <CircleMarker
            center={[cafe.lat, cafe.lng]}
            key={cafe.id}
            pathOptions={{
              color: '#fff',
              fillColor: cafe.district === 'Ngaliyan' ? '#2b7a69' : '#c16e42',
              fillOpacity: 0.95,
              weight: 2,
            }}
            radius={6}
          >
            <Popup>
              <strong>{cafe.name}</strong>
              {cafe.district && <div>Kecamatan {cafe.district}</div>}
              {cafe.ambience?.length > 0 && (
                <div>
                  Suasana: {cafe.ambience
                    .map((ambience) => ambienceOptions.find(({ value }) => value === ambience)?.label)
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}
              {cafe.locationPrecision === 'approximate' && <div>Pin perkiraan kawasan</div>}
              <a
                href={cafe.sourceUrl || `https://www.openstreetmap.org/${cafe.id}`}
                rel="noreferrer"
                target="_blank"
              >
                {cafe.sourceName ? `Buka sumber: ${cafe.sourceName}` : 'Buka data OpenStreetMap'}
              </a>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}

export default CafeMap
