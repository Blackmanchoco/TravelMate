import { mapDestinationDto } from "./destination.mapper";
import { mapPlaceDto } from "./place.mapper";
import type {
  ItineraryDetail,
  ItineraryDetailDto,
  ItineraryItem,
  ItineraryItemDto,
  ItinerarySummary,
  ItinerarySummaryDto,
} from "../types/itinerary";

function toNullableNumber(value: string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapBase(dto: ItinerarySummaryDto | ItineraryDetailDto) {
  return {
    id: dto.id,
    destinationId: dto.destinationId,
    title: dto.title,
    startDate: dto.startDate,
    endDate: dto.endDate,
    budget: toNullableNumber(dto.budget),
    status: dto.status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    destination: dto.destination ? mapDestinationDto(dto.destination) : null,
  };
}

export function mapItinerarySummaryDto(dto: ItinerarySummaryDto): ItinerarySummary {
  return { ...mapBase(dto), itemCount: dto._count.items };
}

export function mapItineraryDetailDto(dto: ItineraryDetailDto): ItineraryDetail {
  return {
    ...mapBase(dto),
    items: dto.items.map(mapItineraryItemDto),
  };
}

export function mapItineraryItemDto(item: ItineraryItemDto): ItineraryItem {
  return {
    id: item.id,
    itineraryId: item.itineraryId,
    placeId: item.placeId,
    day: item.day,
    timeSlot: item.timeSlot,
    order: item.order,
    notes: item.notes,
    estimatedDuration: item.estimatedDuration,
    place: mapPlaceDto(item.place),
  };
}

export function itineraryDetailToSummary(detail: ItineraryDetail): ItinerarySummary {
  const { items, ...base } = detail;
  return { ...base, itemCount: items.length };
}
