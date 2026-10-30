import { useEffect, useMemo, useState } from "react";
import { latLngBounds } from "leaflet";
import type { LatLngTuple } from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { Link } from "react-router-dom";

import type { Place } from "../../types/place";

interface NearbyPlacesMapProps {
  centerPlace: Place;
  nearbyPlaces: Place[];
  radiusKm: number;
}

function hasValidCoordinates(place: Place) {
  const { latitude, longitude } = place;
  return (
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function MapViewportController({ positions }: { positions: LatLngTuple[] }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }

    map.fitBounds(latLngBounds(positions), {
      padding: [44, 44],
      maxZoom: 14,
    });
  }, [map, positions]);

  return null;
}

export function NearbyPlacesMap({
  centerPlace,
  nearbyPlaces,
  radiusKm,
}: NearbyPlacesMapProps) {
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const center = useMemo<LatLngTuple>(
    () => [centerPlace.latitude!, centerPlace.longitude!],
    [centerPlace.latitude, centerPlace.longitude],
  );
  const mappedNearbyPlaces = useMemo(
    () => nearbyPlaces.filter(hasValidCoordinates),
    [nearbyPlaces],
  );
  const positions = useMemo<LatLngTuple[]>(
    () => [
      center,
      ...mappedNearbyPlaces.map(
        (place): LatLngTuple => [place.latitude!, place.longitude!],
      ),
    ],
    [center, mappedNearbyPlaces],
  );

  return (
    <div className="relative" role="region" aria-label={`Places near ${centerPlace.name}`}>
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        className="h-[360px] w-full lg:h-[480px]"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: () => setTilesUnavailable(true),
            tileload: () => setTilesUnavailable(false),
          }}
        />
        <MapViewportController positions={positions} />
        <Circle
          center={center}
          radius={radiusKm * 1000}
          pathOptions={{
            color: "var(--color-accent)",
            fillColor: "var(--color-tint)",
            fillOpacity: 0.08,
            opacity: 0.45,
            weight: 2,
          }}
        />
        <CircleMarker
          center={center}
          radius={11}
          pathOptions={{
            color: "var(--color-fg)",
            fillColor: "var(--color-accent)",
            fillOpacity: 1,
            weight: 3,
          }}
        >
          <Popup>
            <p className="font-semibold text-fg">{centerPlace.name}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-accent">
              Current place
            </p>
          </Popup>
        </CircleMarker>

        {mappedNearbyPlaces.map((place) => (
          <CircleMarker
            key={place.id}
            center={[place.latitude!, place.longitude!]}
            radius={8}
            pathOptions={{
              color: "var(--color-fg)",
              fillColor: "var(--color-pop)",
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Popup>
              <div className="min-w-40">
                <p className="font-semibold text-fg">{place.name}</p>
                <p className="mt-1 text-sm text-muted">{place.category}</p>
                <Link
                  to={`/destinations/${place.destinationId}/places/${place.id}`}
                  className="mt-2 inline-flex text-sm font-semibold text-accent hover:text-accent"
                >
                  View place
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {tilesUnavailable && (
        <p role="status" className="pointer-events-none absolute inset-x-4 bottom-4 z-[1000] rounded-control border border-line bg-surface px-4 py-3 text-sm font-medium text-fg shadow-panel">
          Map tiles are unavailable. Check your connection; nearby place details still work.
        </p>
      )}
    </div>
  );
}
