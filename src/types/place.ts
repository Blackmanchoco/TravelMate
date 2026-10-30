import type {
  DestinationReference,
  DestinationReferenceDto,
} from "./destination";

export interface DestinationPlaceDto {
  id: number;
  name: string;
  category: string;
  description: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  rating: string | null;
  priceLevel: number | null;
  imageUrl: string | null;
}

export interface PlaceListDto extends DestinationPlaceDto {
  destinationId: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceDetailDto extends PlaceListDto {
  destination: DestinationReferenceDto;
}

export interface Place {
  id: number;
  destinationId: number;
  name: string;
  category: string;
  description: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  priceLevel: number | null;
  imageUrl: string | null;
  destination?: DestinationReference;
}
