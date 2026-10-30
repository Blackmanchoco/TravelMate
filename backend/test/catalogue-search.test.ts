import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ destinations: vi.fn(), places: vi.fn() }));
vi.mock("../../src/api/destinations.api", () => ({ listDestinations: mocks.destinations }));
vi.mock("../../src/api/places.api", () => ({ listPlaces: mocks.places }));
import { searchCatalogue } from "../../src/components/hero/catalogue-search";
describe("Hero catalogue search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.destinations.mockResolvedValue({ items: [{ id: 1, name: "Kuala Lumpur" }], pagination: { total: 1 } });
    mocks.places.mockResolvedValue({ items: [{ id: 2, destinationId: 1, name: "Fixture place" }], pagination: { total: 9 } });
  });
  it("searches real destination and place endpoints with the trimmed query and shared cancellation", async () => {
    const controller = new AbortController();
    const result = await searchCatalogue("  Kuala Lumpur  ", "", controller.signal);
    expect(mocks.destinations).toHaveBeenCalledWith({ search: "Kuala Lumpur", page: 1, limit: 6 }, controller.signal);
    expect(mocks.places).toHaveBeenCalledWith({ search: "Kuala Lumpur", page: 1, limit: 6 }, controller.signal);
    expect(result.destinations[0].name).toBe("Kuala Lumpur");
    expect(result.places[0].name).toBe("Fixture place");
    expect(result.placeTotal).toBe(9);
  });
  it("uses real category values and does not invent destination results for category-only searches", async () => {
    const result = await searchCatalogue("", "Culture");
    expect(mocks.destinations).not.toHaveBeenCalled();
    expect(mocks.places).toHaveBeenCalledWith({ category: "Culture", page: 1, limit: 6 }, undefined);
    expect(result.destinations).toEqual([]);
  });
  it("does not silently treat endpoint failure as zero matches", async () => {
    mocks.places.mockRejectedValue(new Error("Fixture service failure"));
    await expect(searchCatalogue("Fixture", "")).rejects.toThrow("Fixture service failure");
  });
  it("keeps genuine empty results and performs no request for a blank search", async () => {
    expect(await searchCatalogue("  ", "")).toEqual({ destinations: [], places: [], destinationTotal: 0, placeTotal: 0 });
    expect(mocks.places).not.toHaveBeenCalled();
    mocks.destinations.mockResolvedValue({ items: [], pagination: { total: 0 } });
    mocks.places.mockResolvedValue({ items: [], pagination: { total: 0 } });
    expect((await searchCatalogue("No match", "")).placeTotal).toBe(0);
  });
});
