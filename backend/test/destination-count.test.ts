import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn() }));
vi.mock("../src/lib/prisma.js", () => ({ prisma: { destination: mocks } }));
import { getDestinations } from "../src/modules/destinations/destinations.service.js";
import { publicPlaceWhere } from "../src/modules/places/place-visibility.js";
describe("destination discoverable place counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([{ id: 1, name: "Fixture city", _count: { places: 13 } }]);
    mocks.count.mockResolvedValue(6);
  });
  it("counts only public places using the same archive/Test exclusion as discovery", async () => {
    await getDestinations({ page: 1, limit: 6 });
    expect(mocks.findMany.mock.calls[0][0].select._count).toEqual({ select: { places: { where: publicPlaceWhere } } });
    expect(publicPlaceWhere.deletedAt).toBeNull();
    expect(publicPlaceWhere.NOT).toEqual({ category: { equals: "Test", mode: "insensitive" } });
  });
  it("exposes the real count without changing destination pagination", async () => {
    const result = await getDestinations({ search: "Fixture", page: 2, limit: 3 });
    expect(result.items[0]).toEqual({ id: 1, name: "Fixture city", placeCount: 13 });
    expect(result.pagination).toEqual({ page: 2, limit: 3, total: 6, totalPages: 2 });
    expect(mocks.findMany.mock.calls[0][0]).toMatchObject({ skip: 3, take: 3, orderBy: { name: "asc" } });
  });
  it("keeps a genuine zero instead of inventing a tile count", async () => {
    mocks.findMany.mockResolvedValue([{ id: 2, name: "Empty fixture", _count: { places: 0 } }]);
    expect((await getDestinations({ page: 1, limit: 6 })).items[0].placeCount).toBe(0);
  });
});
