import { prisma } from "../../lib/prisma.js";
import { publicPlaceWhere } from "../places/place-visibility.js";
import { normalizePlaceSearch } from "../places/place-search-alias.js";

type GetDestinationsInput = {
  search?: string;
  city?: string;
  state?: string;
  page: number;
  limit: number;
};

export async function getDestinations(
  input: GetDestinationsInput,
) {
  const { search, city, state, page, limit } = input;
  const canonicalSearch = normalizePlaceSearch(search);

  const where = {
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              description: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            ...(canonicalSearch === "Kuala Lumpur Tower" ? [{
              places: { some: { ...publicPlaceWhere,
                name: { equals: canonicalSearch, mode: "insensitive" as const } } },
            }] : []),
          ],
        }
      : {}),
    ...(city
      ? {
          city: {
            equals: city,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(state
      ? {
          state: {
            equals: state,
            mode: "insensitive" as const,
          },
        }
      : {}),
  };

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.destination.findMany({
      where,
      orderBy: {
        name: "asc",
      },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        description: true,
        imageUrl: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { places: { where: publicPlaceWhere } } },
      },
    }),
    prisma.destination.count({ where }),
  ]);

  return {
    items: items.map(({ _count, ...destination }) => ({
      ...destination,
      placeCount: _count.places,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getDestinationById(id: number) {
  return prisma.destination.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      description: true,
      imageUrl: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      updatedAt: true,
      places: {
        where: publicPlaceWhere,
        orderBy: [
          {
            rating: "desc",
          },
          {
            name: "asc",
          },
        ],
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          address: true,
          latitude: true,
          longitude: true,
          rating: true,
          priceLevel: true,
          imageUrl: true,
        },
      },
    },
  });
}
