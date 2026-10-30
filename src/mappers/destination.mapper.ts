import type { Destination, DestinationDto } from "../types/destination";

function toNullableNumber(value: string | null) {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapDestinationDto(dto: DestinationDto): Destination {
  return {
    id: dto.id,
    name: dto.name,
    city: dto.city,
    state: dto.state,
    description: dto.description,
    imageUrl: dto.imageUrl,
    placeCount: dto.placeCount,
    latitude: toNullableNumber(dto.latitude),
    longitude: toNullableNumber(dto.longitude),
  };
}
