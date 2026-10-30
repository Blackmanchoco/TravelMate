import type { Destination, DestinationDto } from "./destination";
import type { Place, PlaceListDto } from "./place";

export interface ItineraryItemDto {
  id: number;
  itineraryId: number;
  placeId: number;
  day: number;
  timeSlot: "Morning" | "Afternoon" | "Evening";
  order: number;
  notes: string | null;
  estimatedDuration: string | null;
  createdAt: string;
  updatedAt: string;
  place: PlaceListDto;
}

export interface ItineraryItem {
  id: number;
  itineraryId: number;
  placeId: number;
  day: number;
  timeSlot: "Morning" | "Afternoon" | "Evening";
  order: number;
  notes: string | null;
  estimatedDuration: string | null;
  place: Place;
}

interface ItineraryBaseDto {
  id: number;
  userId: string;
  destinationId: number | null;
  title: string;
  startDate: string | null;
  endDate: string | null;
  budget: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  destination: DestinationDto | null;
}

export interface ItinerarySummaryDto extends ItineraryBaseDto {
  _count: { items: number };
}

export interface ItineraryDetailDto extends ItineraryBaseDto {
  items: ItineraryItemDto[];
}

export interface ItinerarySummary {
  id: number;
  destinationId: number | null;
  title: string;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  destination: Destination | null;
  itemCount: number;
}

export interface ItineraryDetail extends Omit<ItinerarySummary, "itemCount"> {
  items: ItineraryItem[];
}

export interface CreateItineraryInput {
  title: string;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  destinationId?: number | null;
}

export interface UpdateItineraryInput {
  title?: string;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  destinationId?: number | null;
  status?: string;
}

export interface CreateItineraryItemInput {
  placeId: number;
  day: number;
  timeSlot: "Morning" | "Afternoon" | "Evening";
  order?: number;
  notes?: string | null;
  estimatedDuration?: string | null;
}

export interface UpdateItineraryItemInput {
  placeId?: number;
  day?: number;
  timeSlot?: "Morning" | "Afternoon" | "Evening";
  order?: number;
  notes?: string | null;
  estimatedDuration?: string | null;
}
