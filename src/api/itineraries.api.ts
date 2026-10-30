import { apiRequest } from "../lib/api-client";
import {
  mapItineraryDetailDto,
  mapItineraryItemDto,
  mapItinerarySummaryDto,
} from "../mappers/itinerary.mapper";
import type { Paginated, PaginatedDto } from "../types/api";
import type {
  CreateItineraryInput,
  CreateItineraryItemInput,
  ItineraryDetail,
  ItineraryDetailDto,
  ItineraryItem,
  ItineraryItemDto,
  ItinerarySummary,
  ItinerarySummaryDto,
  UpdateItineraryInput,
  UpdateItineraryItemInput,
} from "../types/itinerary";
import type { ItineraryWeather } from "../types/itinerary-weather";

const ITINERARIES_LIMIT = 100;

export async function listItineraries(page = 1, limit = ITINERARIES_LIMIT, signal?: AbortSignal): Promise<Paginated<ItinerarySummary>> {
  const result = await apiRequest<PaginatedDto<ItinerarySummaryDto>>(
    `/itineraries?page=${page}&limit=${limit}`,
    { auth: true, signal },
  );
  return {
    items: result.items.map(mapItinerarySummaryDto),
    pagination: result.pagination,
  };
}

export async function getItinerary(id: number, signal?: AbortSignal): Promise<ItineraryDetail> {
  const result = await apiRequest<ItineraryDetailDto>(`/itineraries/${id}`, { auth: true, signal });
  return mapItineraryDetailDto(result);
}

export function getItineraryWeather(id: number, signal?: AbortSignal): Promise<ItineraryWeather> {
  return apiRequest<ItineraryWeather>(`/itineraries/${id}/weather`, { auth: true, signal });
}

export async function createItinerary(input: CreateItineraryInput): Promise<ItineraryDetail> {
  const result = await apiRequest<ItineraryDetailDto>("/itineraries", {
    method: "POST",
    auth: true,
    body: input,
  });
  return mapItineraryDetailDto(result);
}

export async function updateItinerary(id: number, input: UpdateItineraryInput): Promise<ItineraryDetail> {
  const result = await apiRequest<ItineraryDetailDto>(`/itineraries/${id}`, {
    method: "PATCH",
    auth: true,
    body: input,
  });
  return mapItineraryDetailDto(result);
}

export async function deleteItinerary(id: number): Promise<void> {
  await apiRequest<void>(`/itineraries/${id}`, { method: "DELETE", auth: true });
}

export async function createItineraryItem(itineraryId: number, input: CreateItineraryItemInput): Promise<ItineraryItem> {
  const result = await apiRequest<ItineraryItemDto>(`/itineraries/${itineraryId}/items`, {
    method: "POST",
    auth: true,
    body: input,
  });
  return mapItineraryItemDto(result);
}

export async function updateItineraryItem(itineraryId: number, itemId: number, input: UpdateItineraryItemInput): Promise<ItineraryItem> {
  const result = await apiRequest<ItineraryItemDto>(`/itineraries/${itineraryId}/items/${itemId}`, {
    method: "PATCH",
    auth: true,
    body: input,
  });
  return mapItineraryItemDto(result);
}

export async function deleteItineraryItem(itineraryId: number, itemId: number): Promise<void> {
  await apiRequest<void>(`/itineraries/${itineraryId}/items/${itemId}`, {
    method: "DELETE",
    auth: true,
  });
}
