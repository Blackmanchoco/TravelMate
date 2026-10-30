import { AdminAuditAction, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../core/errors/app-error.js";
import { isRestorablePlace, protectedPlaceError } from "./admin-place-protection.js";
import { ADMIN_PLACE_LIMITS, MALAYSIA_BOUNDS, normalizeDisplayTags, parseCreatePlaceInput, type CreatePlaceInput } from "./admin-place-validation.js";
import { ADMIN_VOCABULARY } from "./admin-vocabulary.js";
import {
  activePlaceWhere,
  archivedNonTestPlaceWhere,
  nonTestPlaceWhere,
  publicPlaceWhere,
  testPlaceWhere,
} from "../places/place-visibility.js";

type PaginationInput = {
  page: number;
  limit: number;
};

function pagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getAdminStats() {
  const [users, destinations, activePlaces, itineraries, savedPlaces] =
    await Promise.all([
      prisma.user.count(),
      prisma.destination.count(),
      prisma.place.count({ where: publicPlaceWhere }),
      prisma.itinerary.count(),
      prisma.savedPlace.count({
        where: { place: publicPlaceWhere },
      }),
    ]);

  return {
    users,
    destinations,
    activePlaces,
    itineraries,
    savedPlaces,
  };
}

export async function getCatalogReport() {
  const [discoverable, archived, test, destinations, discoverableByDestination,
    archivedByDestination, categories, places, savedGroups, itineraryGroups, auditActions] = await Promise.all([
    prisma.place.count({ where: publicPlaceWhere }),
    prisma.place.count({ where: archivedNonTestPlaceWhere }),
    prisma.place.count({ where: testPlaceWhere }),
    prisma.destination.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true } }),
    prisma.place.groupBy({ by: ["destinationId"], where: publicPlaceWhere, _count: { _all: true } }),
    prisma.place.groupBy({ by: ["destinationId"], where: archivedNonTestPlaceWhere, _count: { _all: true } }),
    prisma.place.groupBy({ by: ["category"], where: publicPlaceWhere, _count: { _all: true }, orderBy: { category: "asc" } }),
    prisma.place.findMany({
      where: publicPlaceWhere,
      select: {
        id: true, name: true, priceLevel: true, latitude: true, longitude: true,
        tags: true, travelStyleTags: true, activityTypes: true, description: true,
        destination: { select: { name: true } },
      },
    }),
    prisma.savedPlace.groupBy({ by: ["placeId"], where: { place: publicPlaceWhere }, _count: { _all: true } }),
    prisma.itineraryItem.groupBy({ by: ["placeId"], where: { place: publicPlaceWhere }, _count: { _all: true } }),
    prisma.adminAuditLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { action: "asc" } }),
  ]);

  const discoverableCounts = new Map(discoverableByDestination.map((row) => [row.destinationId, row._count._all]));
  const archivedCounts = new Map(archivedByDestination.map((row) => [row.destinationId, row._count._all]));
  const savedCounts = new Map(savedGroups.map((row) => [row.placeId, row._count._all]));
  const itemCounts = new Map(itineraryGroups.map((row) => [row.placeId, row._count._all]));

  const missing = {
    priceLevel: places.filter((place) => place.priceLevel === null).length,
    coordinates: places.filter((place) => place.latitude === null || place.longitude === null).length,
    tags: places.filter((place) => place.tags.length === 0).length,
    travelStyleTags: places.filter((place) => place.travelStyleTags.length === 0).length,
    activityTypes: places.filter((place) => place.activityTypes.length === 0).length,
    description: places.filter((place) => place.description.trim().length === 0).length,
  };
  const metric = (count: number) => ({
    missing: count,
    missingRatio: discoverable === 0 ? 0 : Math.round((count / discoverable) * 10_000) / 10_000,
  });

  const engagement = places.map((place) => ({
    placeId: place.id,
    name: place.name,
    destination: place.destination.name,
    savedCount: savedCounts.get(place.id) ?? 0,
    itineraryItemCount: itemCounts.get(place.id) ?? 0,
  }));
  const score = (place: (typeof engagement)[number]) => place.savedCount + place.itineraryItemCount;

  return {
    generatedAt: new Date().toISOString(),
    auditSummary: { total: auditActions.reduce((sum, row) => sum + row._count._all, 0),
      byAction: auditActions.map((row) => ({ action: row.action, count: row._count._all })) },
    totals: { discoverable, archived, test },
    byDestination: destinations.map((destination) => ({
      destinationId: destination.id,
      name: destination.name,
      discoverable: discoverableCounts.get(destination.id) ?? 0,
      archived: archivedCounts.get(destination.id) ?? 0,
    })),
    byCategory: categories.map((row) => ({ category: row.category, count: row._count._all })),
    completeness: {
      total: discoverable,
      priceLevel: metric(missing.priceLevel),
      coordinates: metric(missing.coordinates),
      tags: metric(missing.tags),
      travelStyleTags: metric(missing.travelStyleTags),
      activityTypes: metric(missing.activityTypes),
      description: metric(missing.description),
    },
    engagement: {
      mostEngaged: [...engagement].sort((a, b) => score(b) - score(a) || a.placeId - b.placeId).slice(0, 5),
      leastEngaged: [...engagement].sort((a, b) => score(a) - score(b) || a.placeId - b.placeId).slice(0, 5),
    },
  };
}

type ListAdminUsersInput = PaginationInput & {
  search?: string;
};

export async function listAdminUsers(input: ListAdminUsersInput) {
  const { page, limit, search } = input;
  const where: Prisma.UserWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            itineraries: true,
            savedPlaces: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { items, pagination: pagination(page, limit, total) };
}

export type AdminPlaceStatus = "active" | "archived" | "all";

type ListAdminPlacesInput = PaginationInput & {
  search?: string;
  category?: string;
  destinationId?: number;
  status: AdminPlaceStatus;
  includeTest?: boolean;
};

export async function listAdminPlaces(input: ListAdminPlacesInput) {
  const {
    page,
    limit,
    search,
    category,
    destinationId,
    status,
    includeTest = false,
  } = input;
  const where: Prisma.PlaceWhereInput = {
    ...(includeTest ? {} : nonTestPlaceWhere),
    ...(status === "active"
      ? activePlaceWhere
      : status === "archived"
        ? { deletedAt: { not: null } }
        : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { address: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(category
      ? { category: { equals: category, mode: "insensitive" } }
      : {}),
    ...(destinationId === undefined ? {} : { destinationId }),
  };
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.place.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip,
      take: limit,
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
        createdAt: true,
        updatedAt: true,
        destination: {
          select: { id: true, name: true, city: true, state: true },
        },
        _count: {
          select: { savedBy: true, itineraryItems: true },
        },
      },
    }),
    prisma.place.count({ where }),
  ]);

  return {
    items: items.map((place) => ({
      ...place,
      restorable: isRestorablePlace(place),
      restoreDisabledReason: protectedPlaceError(place)?.message ?? null,
    })),
    pagination: pagination(page, limit, total),
  };
}

export async function getAdminPlaceOptions(displayTags?: string) {
  const [destinations, categoryRows] = await Promise.all([
    prisma.destination.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.place.findMany({ where: publicPlaceWhere, distinct: ["category"], orderBy: { category: "asc" }, select: { category: true } }),
  ]);
  return {
    destinations,
    categories: categoryRows.map((row) => row.category),
    vocabulary: ADMIN_VOCABULARY,
    bounds: MALAYSIA_BOUNDS,
    limits: ADMIN_PLACE_LIMITS,
    displayTagsSeparator: "comma" as const,
    displayTagsPreview: displayTags ? normalizeDisplayTags(displayTags.split(",")) : [],
  };
}

export async function createAdminPlace(adminUserId: string, body: unknown) {
  const categories = (await prisma.place.findMany({
    where: publicPlaceWhere,
    distinct: ["category"],
    select: { category: true },
  })).map((row) => row.category);
  const input = parseCreatePlaceInput(body, categories);
  return createValidatedPlace(adminUserId, input);
}

export async function createValidatedPlace(adminUserId: string, input: CreatePlaceInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const destination = await tx.destination.findUnique({ where: { id: input.destinationId }, select: { id: true } });
      if (!destination) throw new AppError("Destination not found.", 400, "VALIDATION_ERROR");
      const duplicate = await tx.place.findFirst({
        where: { destinationId: input.destinationId, name: { equals: input.name, mode: "insensitive" } },
        select: { id: true },
      });
      // The database expression index also catches whitespace-normalized concurrent inserts.
      if (duplicate) throw new AppError("Place name already exists in this destination.", 409, "PLACE_NAME_EXISTS");
      const place = await tx.place.create({
        data: input,
        select: { id: true, destinationId: true, name: true, deletedAt: true },
      });
      await tx.adminAuditLog.create({
        data: {
          adminUserId,
          action: AdminAuditAction.PLACE_CREATED,
          targetType: "Place",
          targetId: String(place.id),
          targetLabel: place.name,
          metadata: { placeId: place.id, name: place.name, destinationId: place.destinationId },
        },
      });
      return { ...place, status: "active" as const };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("Place name already exists in this destination.", 409, "PLACE_NAME_EXISTS");
    }
    throw error;
  }
}

export async function restorePlace(adminUserId: string, placeId: number) {
  return prisma.$transaction(async (tx) => {
    const place = await tx.place.findUnique({
      where: { id: placeId },
      select: { id: true, name: true, category: true, destinationId: true, deletedAt: true },
    });
    if (!place) throw new AppError("Place not found.", 404, "PLACE_NOT_FOUND");
    const protection = protectedPlaceError(place);
    if (protection) throw new AppError(protection.message, 403, protection.code);
    if (!place.deletedAt) throw new AppError("Place is not archived.", 409, "PLACE_NOT_ARCHIVED");
    const updated = await tx.place.updateMany({
      where: { id: placeId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (updated.count !== 1) throw new AppError("Place is not archived.", 409, "PLACE_NOT_ARCHIVED");
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: AdminAuditAction.PLACE_RESTORED,
        targetType: "Place",
        targetId: String(place.id),
        targetLabel: place.name,
        metadata: { placeId: place.id, name: place.name, destinationId: place.destinationId },
      },
    });
    return { id: place.id, status: "active" as const, deletedAt: null };
  });
}

type ListAdminItinerariesInput = PaginationInput & {
  search?: string;
  userId?: string;
  status?: string;
};

export async function listAdminItineraries(
  input: ListAdminItinerariesInput,
) {
  const { page, limit, search, userId, status } = input;
  const where: Prisma.ItineraryWhereInput = {
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(userId === undefined ? {} : { userId }),
    ...(status
      ? { status: { equals: status, mode: "insensitive" } }
      : {}),
  };
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.itinerary.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip,
      take: limit,
      select: {
        id: true,
        userId: true,
        destinationId: true,
        title: true,
        startDate: true,
        endDate: true,
        budget: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        destination: {
          select: { id: true, name: true, city: true, state: true },
        },
        _count: { select: { items: true } },
      },
    }),
    prisma.itinerary.count({ where }),
  ]);

  return { items, pagination: pagination(page, limit, total) };
}

export async function archivePlace(adminUserId: string, placeId: number) {
  return prisma.$transaction(async (tx) => {
    const place = await tx.place.findUnique({
      where: { id: placeId },
      select: {
        id: true,
        destinationId: true,
        name: true,
        category: true,
        deletedAt: true,
        _count: {
          select: {
            savedBy: true,
            itineraryItems: true,
          },
        },
      },
    });

    if (!place) {
      throw new AppError("Place not found.", 404, "PLACE_NOT_FOUND");
    }
    const protection = protectedPlaceError(place);
    if (protection) throw new AppError(protection.message, 403, protection.code);
    if (place.deletedAt) {
      throw new AppError(
        "Place is already archived.",
        409,
        "PLACE_ALREADY_ARCHIVED",
      );
    }

    const deletedAt = new Date();
    const archived = await tx.place.updateMany({
      where: { id: placeId, deletedAt: null },
      data: { deletedAt },
    });
    if (archived.count !== 1) {
      throw new AppError(
        "Place is already archived.",
        409,
        "PLACE_ALREADY_ARCHIVED",
      );
    }

    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: AdminAuditAction.PLACE_ARCHIVED,
        targetType: "Place",
        targetId: String(place.id),
        targetLabel: place.name,
        metadata: {
          destinationId: place.destinationId,
          category: place.category,
          savedPlaceReferenceCount: place._count.savedBy,
          itineraryItemReferenceCount: place._count.itineraryItems,
        },
      },
    });

    return {
      id: place.id,
      status: "archived" as const,
      deletedAt,
    };
  });
}

export async function deleteAdminItinerary(
  adminUserId: string,
  itineraryId: number,
) {
  return prisma.$transaction(async (tx) => {
    const itinerary = await tx.itinerary.findUnique({
      where: { id: itineraryId },
      select: {
        id: true,
        userId: true,
        destinationId: true,
        title: true,
        status: true,
        _count: { select: { items: true } },
      },
    });

    if (!itinerary) {
      throw new AppError(
        "Itinerary not found.",
        404,
        "ITINERARY_NOT_FOUND",
      );
    }

    await tx.itinerary.delete({ where: { id: itineraryId } });
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: AdminAuditAction.ITINERARY_DELETED,
        targetType: "Itinerary",
        targetId: String(itinerary.id),
        targetLabel: itinerary.title,
        metadata: {
          ownerUserId: itinerary.userId,
          destinationId: itinerary.destinationId,
          status: itinerary.status,
          itemCount: itinerary._count.items,
        },
      },
    });

    return { id: itinerary.id, status: "deleted" as const };
  });
}
