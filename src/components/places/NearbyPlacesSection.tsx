import { useEffect, useState } from "react";
import { LoaderCircle, MapPinned, RefreshCw, Star } from "lucide-react";
import { Link } from "react-router-dom";

import { listNearbyPlaces } from "../../api/places.api";
import type { Place } from "../../types/place";
import { NearbyPlacesMap } from "./NearbyPlacesMap";

const NEARBY_RADIUS_KM = 5;
const NEARBY_DISPLAY_LIMIT = 6;

interface NearbyPlacesSectionProps {
  place: Place;
}

function hasValidCoordinates(place: Place) {
  return (
    place.latitude !== null &&
    place.longitude !== null &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    place.latitude >= -90 &&
    place.latitude <= 90 &&
    place.longitude >= -180 &&
    place.longitude <= 180
  );
}

export function NearbyPlacesSection({ place }: NearbyPlacesSectionProps) {
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const hasCoordinates = hasValidCoordinates(place);

  useEffect(() => {
    if (!hasCoordinates) {
      setNearbyPlaces([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    setNearbyPlaces([]);

    listNearbyPlaces(
      {
        latitude: place.latitude!,
        longitude: place.longitude!,
        radiusKm: NEARBY_RADIUS_KM,
        limit: NEARBY_DISPLAY_LIMIT + 1,
      },
      controller.signal,
    )
      .then((places) => {
        setNearbyPlaces(
          places
            .filter((nearbyPlace) => nearbyPlace.id !== place.id)
            .slice(0, NEARBY_DISPLAY_LIMIT),
        );
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }

        setError("Nearby places could not be loaded. Please try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [hasCoordinates, place.id, place.latitude, place.longitude, retryKey]);

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-accent">
            <MapPinned size={20} />
            <p className="text-sm font-semibold uppercase tracking-wider">Nearby exploration</p>
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-fg">
            Places near {place.name}
          </h2>
          <p className="mt-2 text-sm text-muted">
            Explore public places within {NEARBY_RADIUS_KM} km. The blue marker is your current place.
          </p>
        </div>
        {hasCoordinates && (
          <p className="text-sm text-muted">
            {place.latitude!.toFixed(4)}, {place.longitude!.toFixed(4)}
          </p>
        )}
      </div>

      {!hasCoordinates ? (
        <StatePanel
          title="Nearby places unavailable"
          message="This place does not have valid coordinates, so nearby places cannot be calculated."
        />
      ) : loading ? (
        <div className="flex min-h-72 items-center justify-center gap-2 rounded-panel border border-line bg-surface text-sm text-muted">
          <LoaderCircle size={20} className="animate-spin" />
          Loading nearby places...
        </div>
      ) : error ? (
        <StatePanel title="Unable to load nearby places" message={error}>
          <button
            type="button"
            onClick={() => setRetryKey((current) => current + 1)}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-fg px-4 py-2 text-sm font-semibold text-accent-fg"
          >
            <RefreshCw size={15} />
            Retry
          </button>
        </StatePanel>
      ) : nearbyPlaces.length === 0 ? (
        <StatePanel
          title="No other places found nearby"
          message={`There are no other public places within ${NEARBY_RADIUS_KM} km of this location.`}
        />
      ) : (
        <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel lg:grid lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
          <NearbyPlacesMap
            centerPlace={place}
            nearbyPlaces={nearbyPlaces}
            radiusKm={NEARBY_RADIUS_KM}
          />
          <div className="max-h-[480px] overflow-y-auto border-t border-line p-4 lg:border-l lg:border-t-0">
            <p className="px-2 pb-3 text-sm font-semibold text-fg">
              {nearbyPlaces.length} nearby {nearbyPlaces.length === 1 ? "place" : "places"}
            </p>
            <div className="space-y-2">
              {nearbyPlaces.map((nearbyPlace) => (
                <Link
                  key={nearbyPlace.id}
                  to={`/destinations/${nearbyPlace.destinationId}/places/${nearbyPlace.id}`}
                  className="block rounded-panel border border-line p-4 transition hover:border-line hover:bg-tint/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-fg">{nearbyPlace.name}</p>
                      <p className="mt-1 text-sm text-muted">{nearbyPlace.category}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-fg">
                      <Star size={14} fill="currentColor" />
                      {nearbyPlace.rating?.toFixed(1) ?? "—"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                    {nearbyPlace.address ?? "Address unavailable"}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StatePanel({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-panel border border-line bg-surface px-6 py-12 text-center shadow-panel">
      <h3 className="text-lg font-semibold text-fg">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">{message}</p>
      {children}
    </div>
  );
}
