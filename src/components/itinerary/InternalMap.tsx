import { useEffect, useMemo, useState } from "react";
import { divIcon, latLngBounds } from "leaflet";
import type { LatLngTuple } from "leaflet";
import { MapPin } from "lucide-react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";

import type { ItineraryItem } from "../../types/itinerary";

interface InternalMapProps {
  items: ItineraryItem[];
}

interface MappedPlace {
  item: ItineraryItem;
  position: LatLngTuple;
  visitOrder: number;
}

const MALAYSIA_CENTER: LatLngTuple = [4.2105, 101.9758];
const timeSlotOrder: Record<ItineraryItem["timeSlot"], number> = {
  Morning: 0,
  Afternoon: 1,
  Evening: 2,
};

function hasValidCoordinates(item: ItineraryItem) {
  const { latitude, longitude } = item.place;
  return (
    latitude !== null && longitude !== null &&
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
  );
}

function createVisitIcon(visitOrder: number) {
  return divIcon({
    className: "itinerary-map-marker",
    html: `<span class="itinerary-map-marker__number">${visitOrder}</span>`,
    iconAnchor: [18, 18],
    iconSize: [36, 36],
    popupAnchor: [0, -20],
  });
}

function MapViewportController({ positions }: { positions: LatLngTuple[] }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }

    if (positions.length > 1) {
      map.fitBounds(latLngBounds(positions), {
        padding: [36, 36],
        maxZoom: 14,
      });
    }
  }, [map, positions]);

  return null;
}

export function InternalMap({ items }: InternalMapProps) {
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const orderedItems = useMemo(
    () =>
      [...items].sort((left, right) =>
        left.day - right.day ||
        timeSlotOrder[left.timeSlot] - timeSlotOrder[right.timeSlot] ||
        left.order - right.order ||
        left.id - right.id),
    [items],
  );

  const mappedPlaces = useMemo(
    () =>
      orderedItems
        .map((item, index): MappedPlace | null =>
          hasValidCoordinates(item)
            ? {
                item,
                visitOrder: index + 1,
                position: [item.place.latitude!, item.place.longitude!],
              }
            : null,
        )
        .filter((place): place is MappedPlace => place !== null),
    [orderedItems],
  );

  const positions = useMemo(
    () => mappedPlaces.map((place) => place.position),
    [mappedPlaces],
  );
  const missingCoordinatesCount = items.length - mappedPlaces.length;

  return (
    <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
      <div className="flex flex-col gap-2 border-b border-line px-5 py-5 sm:px-7">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-panel bg-tint text-accent">
            <MapPin size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-fg">Visit order at a glance</h2>
            <p className="mt-1 text-sm text-muted">
              Markers follow your day and time-slot order. Straight lines connect stops in visit order; they do not show road navigation.
            </p>
          </div>
        </div>

        {missingCoordinatesCount > 0 && (
          <p className="rounded-panel border border-line bg-bg px-4 py-3 text-sm font-medium text-fg">
            {missingCoordinatesCount} {missingCoordinatesCount === 1 ? "place is" : "places are"} missing coordinates and cannot be shown on the map.
          </p>
        )}
      </div>

      {mappedPlaces.length === 0 ? (
        <div className="flex min-h-72 items-center justify-center px-6 text-center text-sm text-muted">
          Add a place with valid coordinates to preview the visit order.
        </div>
      ) : (
        <div role="region" aria-label="Itinerary location map" className="relative">
          <MapContainer
            center={positions[0] ?? MALAYSIA_CENTER}
            zoom={7}
            scrollWheelZoom={false}
            className="h-[360px] w-full md:h-[460px]"
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

            {positions.length > 1 && (
              <Polyline
                positions={positions}
                pathOptions={{ color: "var(--color-accent)", opacity: 0.8, weight: 4 }}
              />
            )}

            {mappedPlaces.map(({ item, position, visitOrder }) => (
              <Marker
                key={item.id}
                position={position}
                icon={createVisitIcon(visitOrder)}
              >
                <Popup>
                  <div className="min-w-44">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                      Stop {visitOrder} · Day {item.day} · {item.timeSlot} · Order {item.order}
                    </p>
                    <p className="mt-1 font-semibold text-fg">{item.place.name}</p>
                    <p className="mt-1 text-sm text-muted">{item.place.address ?? "Address unavailable"}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          {tilesUnavailable && (
            <p role="status" className="pointer-events-none absolute inset-x-4 bottom-4 z-[1000] rounded-control border border-line bg-surface px-4 py-3 text-sm font-medium text-fg shadow-panel">
              Map tiles are unavailable. Check your connection; your itinerary and place list still work.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
