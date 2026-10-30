import type { DestinationReferenceDto } from "../types/destination";
import type {
  DestinationPlaceDto,
  Place,
  PlaceDetailDto,
  PlaceListDto,
} from "../types/place";

function toNullableNumber(value: string | null) {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapDestinationReference(dto: DestinationReferenceDto) {
  return {
    id: dto.id,
    name: dto.name,
    city: dto.city,
    state: dto.state,
  };
}

export function mapDestinationPlaceDto(
  dto: DestinationPlaceDto,
  destinationId: number,
): Place {
  return {
    id: dto.id,
    destinationId,
    name: dto.name,
    category: dto.category,
    description: dto.description,
    address: dto.address,
    latitude: toNullableNumber(dto.latitude),
    longitude: toNullableNumber(dto.longitude),
    rating: toNullableNumber(dto.rating),
    priceLevel: dto.priceLevel,
    imageUrl: dto.imageUrl,
  };
}

export function mapPlaceDto(dto: PlaceListDto): Place {
  return mapDestinationPlaceDto(dto, dto.destinationId);
}

export function mapPlaceDetailDto(dto: PlaceDetailDto): Place {
  return {
    ...mapPlaceDto(dto),
    destination: mapDestinationReference(dto.destination),
  };
}
