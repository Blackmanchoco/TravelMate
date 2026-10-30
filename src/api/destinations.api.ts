import { apiRequest } from "../lib/api-client";
import { mapDestinationDto } from "../mappers/destination.mapper";
import { mapDestinationPlaceDto } from "../mappers/place.mapper";
import type { Paginated, PaginatedDto } from "../types/api";
import type {
  Destination,
  DestinationDetail,
  DestinationDto,
} from "../types/destination";
import type { DestinationPlaceDto } from "../types/place";

export interface ListDestinationsParams {
  search?: string;
  city?: string;
  state?: string;
  page?: number;
  limit?: number;
}

interface DestinationDetailDto extends DestinationDto {
  places: DestinationPlaceDto[];
}

function buildQuery(params: ListDestinationsParams) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function listDestinations(
  params: ListDestinationsParams = {},
  signal?: AbortSignal,
): Promise<Paginated<Destination>> {
  const result = await apiRequest<PaginatedDto<DestinationDto>>(
    `/destinations${buildQuery(params)}`,
    { signal },
  );

  return {
    items: result.items.map(mapDestinationDto),
    pagination: result.pagination,
  };
}

export async function getDestination(id: number): Promise<DestinationDetail> {
  const destination = await apiRequest<DestinationDetailDto>(`/destinations/${id}`);
  return {
    ...mapDestinationDto(destination),
    places: destination.places.map((place) =>
      mapDestinationPlaceDto(place, destination.id),
    ),
  };
}
