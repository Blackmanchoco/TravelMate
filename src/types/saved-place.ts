import type { Place, PlaceDetailDto } from "./place";

export interface SavedPlaceDto {
  id: number;
  userId: string;
  placeId: number;
  createdAt: string;
  place: PlaceDetailDto;
}

export interface SavedPlace {
  id: number;
  placeId: number;
  createdAt: string;
  place: Place;
}
