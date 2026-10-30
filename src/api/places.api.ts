import { apiRequest } from "../lib/api-client";
import { mapPlaceDetailDto, mapPlaceDto } from "../mappers/place.mapper";
import type { Paginated, PaginatedDto } from "../types/api";
import type { Place, PlaceDetailDto, PlaceListDto } from "../types/place";

export interface ListPlacesParams {
  destinationId?: number;
  city?: string;
  category?: string;
  search?: string;
  minRating?: number;
  page?: number;
  limit?: number;
}

export interface ListPlacesByDestinationParams {
  search?: string;
  category?: string;
  minRating?: number;
  page?: number;
  limit?: number;
}

export interface ListNearbyPlacesParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  destinationId?: number;
  category?: string;
  limit?: number;
}

function buildQuery(params: object) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function mapPaginatedPlaces(result: PaginatedDto<PlaceListDto>): Paginated<Place> {
  return {
    items: result.items.map(mapPlaceDto),
    pagination: result.pagination,
  };
}

export async function listPlaces(
  params: ListPlacesParams = {},
  signal?: AbortSignal,
): Promise<Paginated<Place>> {
  const result = await apiRequest<PaginatedDto<PlaceListDto>>(
    `/places${buildQuery(params)}`,
    { signal },
  );
  return mapPaginatedPlaces(result);
}

export async function listPlacesByDestination(
  destinationId: number,
  params: ListPlacesByDestinationParams = {},
): Promise<Paginated<Place>> {
  const result = await apiRequest<PaginatedDto<PlaceListDto>>(
    `/places/destination/${destinationId}${buildQuery(params)}`,
  );
  return mapPaginatedPlaces(result);
}

export async function getPlace(id: number): Promise<Place> {
  const place = await apiRequest<PlaceDetailDto>(`/places/${id}`);
  return mapPlaceDetailDto(place);
}

export async function listPlaceCategories(destinationId?: number): Promise<string[]> {
  return apiRequest<string[]>(
    `/places/categories${buildQuery({ destinationId })}`,
  );
}

export async function listNearbyPlaces(
  params: ListNearbyPlacesParams,
  signal?: AbortSignal,
): Promise<Place[]> {
  const places = await apiRequest<PlaceListDto[]>(
    `/places/nearby${buildQuery(params)}`,
    { signal },
  );
  return places.map(mapPlaceDto);
}
