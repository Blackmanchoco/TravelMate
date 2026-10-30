import type { Place } from "./place";

export interface DestinationDto {
  id: number;
  name: string;
  city: string;
  state: string;
  description: string;
  imageUrl: string;
  placeCount?: number;
  latitude: string | null;
  longitude: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DestinationReferenceDto {
  id: number;
  name: string;
  city: string;
  state: string;
}

export interface Destination {
  id: number;
  name: string;
  city: string;
  state: string;
  description: string;
  imageUrl: string;
  placeCount?: number;
  latitude: number | null;
  longitude: number | null;
}

export interface DestinationReference {
  id: number;
  name: string;
  city: string;
  state: string;
}

export interface DestinationDetail extends Destination {
  places: Place[];
}
