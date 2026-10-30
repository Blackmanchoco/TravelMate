import { mapPlaceDetailDto } from "./place.mapper";
import type { SavedPlace, SavedPlaceDto } from "../types/saved-place";

export function mapSavedPlaceDto(dto: SavedPlaceDto): SavedPlace {
  return {
    id: dto.id,
    placeId: dto.placeId,
    createdAt: dto.createdAt,
    place: mapPlaceDetailDto(dto.place),
  };
}
