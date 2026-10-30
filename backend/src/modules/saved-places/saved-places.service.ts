import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../core/errors/app-error.js";
import { activePlaceWhere } from "../places/place-visibility.js";

const select = {
  id: true,
  userId: true,
  placeId: true,
  createdAt: true,
  place: { include: { destination: true } },
} as const;

type ListSavedPlacesInput = {
  userId: string;
  page: number;
  limit: number;
};

export async function listSavedPlaces(input: ListSavedPlacesInput) {
  const { userId, page, limit } = input;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.savedPlace.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select,
    }),
    prisma.savedPlace.count({ where: { userId } }),
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
export async function savePlace(userId: string, placeId: number) {
  if (!await prisma.place.findFirst({ where: { id: placeId, ...activePlaceWhere }, select: { id: true } })) throw new AppError("Place not found.", 404, "PLACE_NOT_FOUND");
  return prisma.savedPlace.upsert({ where: { userId_placeId: { userId, placeId } }, create: { userId, placeId }, update: {}, select });
}
export async function removeSavedPlace(userId: string, placeId: number) {
  try {
    await prisma.savedPlace.delete({
      where: { userId_placeId: { userId, placeId } },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new AppError(
        "Saved place not found.",
        404,
        "SAVED_PLACE_NOT_FOUND",
      );
    }

    throw error;
  }
}
