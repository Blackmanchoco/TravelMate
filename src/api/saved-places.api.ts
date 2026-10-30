import { apiRequest } from "../lib/api-client";
import { mapSavedPlaceDto } from "../mappers/saved-place.mapper";
import type { Paginated, PaginatedDto } from "../types/api";
import type { SavedPlace, SavedPlaceDto } from "../types/saved-place";

const SAVED_PLACES_LIMIT = 100;

export async function listSavedPlaces(): Promise<Paginated<SavedPlace>> {
  const result = await apiRequest<PaginatedDto<SavedPlaceDto>>(
    `/saved-places?page=1&limit=${SAVED_PLACES_LIMIT}`,
    { auth: true },
  );

  return {
    items: result.items.map(mapSavedPlaceDto),
    pagination: result.pagination,
  };
}

export async function savePlace(placeId: number): Promise<SavedPlace> {
  const result = await apiRequest<SavedPlaceDto>("/saved-places", {
    method: "POST",
    auth: true,
    body: { placeId },
  });

  return mapSavedPlaceDto(result);
}

export async function removeSavedPlace(placeId: number): Promise<void> {
  await apiRequest<void>(`/saved-places/${placeId}`, {
    method: "DELETE",
    auth: true,
  });
}
