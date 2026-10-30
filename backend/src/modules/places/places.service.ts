import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { activePlaceWhere, publicPlaceWhere } from "./place-visibility.js";
import { normalizePlaceSearch } from "./place-search-alias.js";

const EARTH_RADIUS_KM = 6371.0088;

const placeListSelect = {
  id: true,
  destinationId: true,
  name: true,
  category: true,
  description: true,
  address: true,
  latitude: true,
  longitude: true,
  rating: true,
  priceLevel: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlaceSelect;

type GetPlacesInput = {
  destinationId?: number;
  city?: string;
  category?: string;
  search?: string;
  searchField?: "name" | "description";
  minRating?: number;
  page: number;
  limit: number;
};

type GetNearbyPlacesInput = {
  latitude: number;
  longitude: number;
  radiusKm: number;
  destinationId?: number;
  category?: string;
  limit: number;
};

function categoryFilter(category?: string) {
  return category
    ? {
        equals: category,
        mode: "insensitive" as const,
      }
    : undefined;
}

export async function getPlaces(input: GetPlacesInput) {
  const {
    destinationId,
    city,
    category,
    search,
    searchField = "name",
    minRating,
    page,
    limit,
  } = input;
  const normalizedSearch = normalizePlaceSearch(search);

  const where: Prisma.PlaceWhereInput = {
    ...publicPlaceWhere,
    ...(destinationId !== undefined ? { destinationId } : {}),
    ...(city
      ? {
          destination: {
            city: {
              equals: city,
              mode: "insensitive" as const,
            },
          },
        }
      : {}),
    ...(category ? { category: categoryFilter(category) } : {}),
    ...(normalizedSearch
      ? searchField === "description"
        ? { description: { contains: search, mode: "insensitive" as const } }
        : { name: { contains: normalizedSearch, mode: "insensitive" as const } }
      : {}),
    ...(minRating !== undefined ? { rating: { gte: minRating } } : {}),
  };

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.place.findMany({
      where,
      orderBy: [{ rating: "desc" }, { name: "asc" }],
      skip,
      take: limit,
      select: placeListSelect,
    }),
    prisma.place.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getPublicPlaceNames(): Promise<string[]> {
  const rows = await prisma.place.findMany({ where: publicPlaceWhere, select: { name: true } });
  return rows.map((row) => row.name);
}

export async function getPlaceCategories(destinationId?: number) {
  const rows = await prisma.place.findMany({
    where: {
      ...publicPlaceWhere,
      ...(destinationId === undefined ? {} : { destinationId }),
    },
    distinct: ["category"],
    orderBy: { category: "asc" },
    select: { category: true },
  });

  return rows.map(({ category }) => category);
}

function toRadians(value: number) {
  return value * (Math.PI / 180);
}

function haversineDistanceKm(
  latitude: number,
  longitude: number,
  placeLatitude: number,
  placeLongitude: number,
) {
  const latitudeDelta = toRadians(placeLatitude - latitude);
  const longitudeDelta = toRadians(placeLongitude - longitude);
  const startLatitude = toRadians(latitude);
  const endLatitude = toRadians(placeLatitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export async function getNearbyPlaces(input: GetNearbyPlacesInput) {
  const {
    latitude,
    longitude,
    radiusKm,
    destinationId,
    category,
    limit,
  } = input;

  const places = await prisma.place.findMany({
    where: {
      ...publicPlaceWhere,
      latitude: { not: null },
      longitude: { not: null },
      ...(destinationId !== undefined ? { destinationId } : {}),
      ...(category ? { category: categoryFilter(category) } : {}),
    },
    select: placeListSelect,
  });

  return places
    .map((place) => ({
      place,
      distanceKm: haversineDistanceKm(
        latitude,
        longitude,
        Number(place.latitude),
        Number(place.longitude),
      ),
    }))
    .filter(({ distanceKm }) => distanceKm <= radiusKm)
    .sort(
      (left, right) =>
        left.distanceKm - right.distanceKm ||
        left.place.name.localeCompare(right.place.name),
    )
    .slice(0, limit)
    .map(({ place }) => place);
}

type GetPlacesByDestinationInput = {
  destinationId: number;
  search?: string;
  category?: string;
  minRating?: number;
  page: number;
  limit: number;
};

export async function getPlacesByDestination(
  input: GetPlacesByDestinationInput,
) {
  return getPlaces(input);
}

export async function getPlaceById(id: number) {
  return prisma.place.findUnique({
    where: {
      id,
      ...activePlaceWhere,
    },
    select: {
      id: true,
      destinationId: true,
      name: true,
      category: true,
      description: true,
      address: true,
      latitude: true,
      longitude: true,
      rating: true,
      priceLevel: true,
      imageUrl: true,
      deletedAt: true,
      activityTypes: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
      destination: {
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
        },
      },
    },
  });
}
