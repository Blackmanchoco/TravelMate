import { Prisma } from "@prisma/client";

/** A Place that may still be referenced by new user-owned records. */
export const activePlaceWhere = {
  deletedAt: null,
} satisfies Prisma.PlaceWhereInput;

/** Excludes internal fixtures while still allowing Admin to inspect archives. */
export const nonTestPlaceWhere = {
  NOT: {
    category: {
      equals: "Test",
      mode: "insensitive" as const,
    },
  },
} satisfies Prisma.PlaceWhereInput;

/** Archived catalogue records; internal Test fixtures are counted separately. */
export const archivedNonTestPlaceWhere = {
  ...nonTestPlaceWhere,
  deletedAt: { not: null },
} satisfies Prisma.PlaceWhereInput;

/** Internal fixtures, whether active or archived. */
export const testPlaceWhere = {
  category: {
    equals: "Test",
    mode: "insensitive" as const,
  },
} satisfies Prisma.PlaceWhereInput;

/** A Place that may appear in public discovery and recommendation surfaces. */
export const publicPlaceWhere = {
  ...activePlaceWhere,
  ...nonTestPlaceWhere,
} satisfies Prisma.PlaceWhereInput;

export function isPublicPlace(place: {
  category: string;
  deletedAt: Date | null;
}) {
  return place.deletedAt === null && place.category.toLocaleLowerCase() !== "test";
}
