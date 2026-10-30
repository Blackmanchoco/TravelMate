import { listDestinations } from "../../api/destinations.api";
import { listPlaces } from "../../api/places.api";
import type { Destination } from "../../types/destination";
import type { Place } from "../../types/place";

export interface CatalogueResult {
  destinations: Destination[];
  places: Place[];
  destinationTotal: number;
  placeTotal: number;
}

export async function searchCatalogue(query: string, category: string, signal?: AbortSignal): Promise<CatalogueResult> {
  const search = query.trim();
  if (!search && !category) return { destinations: [], places: [], destinationTotal: 0, placeTotal: 0 };
  const [destinations, places] = await Promise.all([
    search ? listDestinations({ search, page: 1, limit: 6 }, signal) : Promise.resolve({ items: [], pagination: { total: 0 } }),
    listPlaces({ ...(search ? { search } : {}), ...(category ? { category } : {}), page: 1, limit: 6 }, signal),
  ]);
  return { destinations: destinations.items, places: places.items, destinationTotal: destinations.pagination.total, placeTotal: places.pagination.total };
}
