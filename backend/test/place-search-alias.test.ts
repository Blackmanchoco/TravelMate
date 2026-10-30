import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ places: vi.fn(), placeCount: vi.fn(), destinations: vi.fn(), destinationCount: vi.fn() }));
vi.mock("../src/lib/prisma.js", () => ({ prisma: {
  place: { findMany: mocks.places, count: mocks.placeCount },
  destination: { findMany: mocks.destinations, count: mocks.destinationCount },
} }));
import { getPlaces, getPlacesByDestination } from "../src/modules/places/places.service.js";
import { getDestinations } from "../src/modules/destinations/destinations.service.js";
import { publicPlaceWhere } from "../src/modules/places/place-visibility.js";
beforeEach(() => {
  vi.clearAllMocks(); mocks.places.mockResolvedValue([]); mocks.placeCount.mockResolvedValue(0);
  mocks.destinations.mockResolvedValue([]); mocks.destinationCount.mockResolvedValue(0);
});

describe("deterministic KL Tower catalogue aliases", () => {
  it.each(["KL Tower", "KL tower", "kl tower", "Menara Kuala Lumpur", "Kuala Lumpur Tower"])(
    "uses the same Tower search for both public place paths: %s", async search => {
      await getPlaces({ destinationId: 1, search, page: 1, limit: 6 });
      await getPlacesByDestination({ destinationId: 1, search, page: 1, limit: 6 });
      for (const [query] of mocks.places.mock.calls) {
        expect(query.where).toMatchObject({
          ...publicPlaceWhere,
          destinationId: 1,
          name: { contains: "Kuala Lumpur Tower", mode: "insensitive" },
        });
        expect(query).toMatchObject({ skip: 0, take: 6 });
      }
      expect(mocks.places).toHaveBeenCalledTimes(2);
      expect(mocks.placeCount).toHaveBeenCalledTimes(2);
    },
  );
  it.each(["xyzabc", "KL"])("does not expand an unrelated or short search: %s", async search => {
    await getPlaces({ destinationId: 1, search, page: 1, limit: 6 });
    await getPlacesByDestination({ destinationId: 1, search, page: 1, limit: 6 });
    for (const [query] of mocks.places.mock.calls) {
      expect(query.where.name).toEqual({ contains: search, mode: "insensitive" });
    }
  });
  it("keeps category, rating, page and archived-place exclusion on both paths", async () => {
    mocks.placeCount.mockResolvedValue(3);
    const input = { destinationId: 1, search: "KL Tower", category: "Restaurant", minRating: 4, page: 2, limit: 1 };
    const general = await getPlaces(input);
    const scoped = await getPlacesByDestination(input);
    for (const [query] of mocks.places.mock.calls) {
      expect(query.where).toMatchObject({
        ...publicPlaceWhere, destinationId: 1,
        name: { contains: "Kuala Lumpur Tower", mode: "insensitive" },
        category: { equals: "Restaurant", mode: "insensitive" },
        rating: { gte: 4 },
      });
      expect(query).toMatchObject({ skip: 1, take: 1 });
    }
    expect(general.pagination).toEqual({ page: 2, limit: 1, total: 3, totalPages: 3 });
    expect(scoped.pagination).toEqual(general.pagination);
  });
  it.each(["KL tower", "Menara Kuala Lumpur"])("preserves existing description fallback query: %s", async search => {
    await getPlaces({ search, searchField: "description", page: 1, limit: 6 });
    expect(mocks.places).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      description: { contains: search, mode: "insensitive" },
    }) }));
  });
  it.each(["Kuala Lumpur Tower", "KL tower", "Menara Kuala Lumpur", "KUALA-LUMPUR, TOWER!"])("normalizes only a known place alias: %s", async search => {
    await getPlaces({ search, page: 1, limit: 6, category: "Attraction", destinationId: 1 });
    expect(mocks.places).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      ...publicPlaceWhere, name: { contains: "Kuala Lumpur Tower", mode: "insensitive" },
      destinationId: 1, category: { equals: "Attraction", mode: "insensitive" },
    }), take: 6, skip: 0 }));
  });
  it.each(["Kuala Lumpur Tower", "KL tower", "Menara Kuala Lumpur", "KUALA-LUMPUR, TOWER!"])("lets Explore find the destination owning the public aliased place: %s", async search => {
    await getDestinations({ search, page: 1, limit: 6, city: "Kuala Lumpur" });
    expect(mocks.destinations).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      city: { equals: "Kuala Lumpur", mode: "insensitive" },
      OR: expect.arrayContaining([{ places: { some: { ...publicPlaceWhere,
        name: { equals: "Kuala Lumpur Tower", mode: "insensitive" } } } }]),
    }) }));
  });
  it.each(["Kuala Lumpur", "Other tower", "KL Tower tickets for sale", "Unlisted Midnight Observatory qzx"])("preserves unrelated queries and destination search semantics: %s", async search => {
    await getPlaces({ search, page: 1, limit: 6 });
    expect(mocks.places).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ name: { contains: search, mode: "insensitive" } }) }));
    await getDestinations({ search, page: 1, limit: 6 });
    expect(mocks.destinations.mock.calls[0]?.[0].where.OR).toHaveLength(2);
  });
});
