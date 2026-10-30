import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => {
  const places = [
    { id: 1, destinationId: 1, name: "Museum", category: "Culture", description: "Exhibits", address: "A", latitude: 3, longitude: 101, rating: 4.8, priceLevel: 1 },
    { id: 2, destinationId: 1, name: "Heritage Hall", category: "Historical", description: "Old building", address: "B", latitude: 3, longitude: 101, rating: 4.5, priceLevel: 1 },
    { id: 3, destinationId: 1, name: "City Park", category: "Nature", description: "Trees", address: "C", latitude: 3, longitude: 101, rating: 4.2, priceLevel: 1 },
    { id: 4, destinationId: 1, name: "Kuala Lumpur Tower", category: "Attraction", description: "Skyline", address: "D", latitude: 3, longitude: 101, rating: 4.7, priceLevel: 3 },
    { id: 5, destinationId: 1, name: "Jalan Alor", category: "Restaurant", description: "Food street", address: "E", latitude: 3, longitude: 101, rating: 4.6, priceLevel: 2 },
    { id: 6, destinationId: 1, name: "Example Stay", category: "Accommodation", description: "Lodging", address: "F", latitude: 3, longitude: 101, rating: 4.1, priceLevel: 2 },
    { id: 7, destinationId: 1, name: "Market Hall", category: "Shopping", description: "Shops", address: "G", latitude: 3, longitude: 101, rating: 4.0, priceLevel: 2 },
  ];
  return { places };
});

vi.mock("../src/modules/destinations/destinations.service.js", () => ({
  getDestinations: vi.fn(async (input: { search?: string; city?: string }) => {
    const match = [input.search, input.city].some((value) => value?.toLowerCase() === "kuala lumpur");
    return { items: match ? [{ id: 1, name: "Kuala Lumpur", city: "Kuala Lumpur", state: "Kuala Lumpur" }] : [], pagination: { total: match ? 1 : 0 } };
  }),
}));
vi.mock("../src/modules/places/places.service.js", () => ({
  getPlaceById: vi.fn(),
  getPlaceCategories: vi.fn(async () => ["Accommodation", "Attraction", "Culture", "Historical", "Nature", "Restaurant"]),
  getPublicPlaceNames: vi.fn(async () => ["Penang Hill", "Kek Lok Si Temple", "George Town"]),
  getPlaces: vi.fn(),
}));

function fixturePlaces(query: { destinationId?: number; search?: string; searchField?: "name" | "description"; category?: string; limit: number }) {
    const items = fixtures.places.filter((place) =>
      (query.destinationId === undefined || place.destinationId === query.destinationId)
      && (!query.category || place.category.toLowerCase() === query.category.toLowerCase())
      && (!query.search || place[query.searchField ?? "name"].toLowerCase().includes(query.search.toLowerCase())));
    return Promise.resolve({ items: items.slice(0, query.limit), pagination: { total: items.length } });
}
vi.mock("../src/modules/recommendations/recommendations.service.js", () => ({ getRecommendations: vi.fn() }));
vi.mock("../src/modules/users/users.service.js", () => ({ getUserPreferences: vi.fn() }));
vi.mock("../src/modules/places/place-visibility.js", () => ({ isPublicPlace: vi.fn(() => true) }));

import { executeSearchPlacesTool, findMentionedPublicPlaceNames, searchPlacesTool } from "../src/modules/ai/ai.tools.js";
import { getPlaces, getPublicPlaceNames } from "../src/modules/places/places.service.js";

beforeEach(() => {
  vi.mocked(getPlaces).mockReset();
  vi.mocked(getPlaces).mockImplementation(fixturePlaces);
});

async function search(args: Record<string, unknown>) {
  const execution = await executeSearchPlacesTool(args, 5_000);
  return { usage: execution.usage, data: JSON.parse(execution.content) as { items?: Array<{ placeId: number; category: string }>; searchMatchSource?: string; availableCategories?: string[] } };
}

describe("search_places category and destination intent", () => {
  it("finds public place names in the current prompt or the prior user turn", async () => {
    expect(await findMentionedPublicPlaceNames("Is George Town UNESCO?", [])).toEqual(["George Town"]);
    expect(await findMentionedPublicPlaceNames("Which of these two is cheaper?", [
      { role: "user", content: "Compare Penang Hill and Kek Lok Si Temple." },
      { role: "assistant", content: "I can compare them." },
    ])).toEqual(["Penang Hill", "Kek Lok Si Temple"]);
  });

  it("bounds the public-name lookup before a model follow-up", async () => {
    vi.mocked(getPublicPlaceNames).mockImplementationOnce(() => new Promise(() => undefined));
    await expect(findMentionedPublicPlaceNames("Is George Town UNESCO?", [], 1))
      .rejects.toThrow("place-name lookup timed out");
  });
  it.each([
    ["Chinese destination and category", { destination: "吉隆坡", search: "文化景点" }],
    ["English destination and category", { destination: "Kuala Lumpur", search: "culture" }],
    ["combined Chinese search", { search: "吉隆坡 文化景点" }],
    ["combined English search", { search: "Kuala Lumpur culture" }],
    ["category without destination", { search: "culture" }],
    ["Chinese category without destination", { search: "文化景点" }],
    ["explicit category argument", { destination: "Kuala Lumpur", category: "Culture" }],
  ])("finds Culture and Historical places for %s", async (_label, args) => {
    const result = await search({ ...args, limit: 10 });
    expect(result.usage.status).toBe("success");
    expect(result.data.items?.map((place) => place.placeId)).toEqual([1, 2]);
  });

  it("accepts a destination without a category", async () => {
    const result = await search({ destination: "吉隆坡", limit: 10 });
    expect(result.data.items).toHaveLength(7);
  });

  it("preserves a named-place search ahead of category interpretation", async () => {
    const result = await search({ search: "Kuala Lumpur Tower", limit: 10 });
    expect(result.data.items?.map((place) => place.placeId)).toEqual([4]);
    expect(result.data.searchMatchSource).toBe("name");
  });

  it("intersects a category with an explicitly named place", async () => {
    const result = await search({ destination: "Kuala Lumpur", search: "Kuala Lumpur Tower", category: "nature", limit: 1 });
    expect(result.data.items).toEqual([]);
  });

  it("rejects an unsupported category even when search text is present", async () => {
    const result = await search({ search: "Museum", category: "UNESCO", limit: 5 });
    expect(result.usage.status).toBe("error");
  });

  it("exposes category in the model tool schema", () => {
    expect(searchPlacesTool.function.parameters.properties).toHaveProperty("category");
  });

  it("keeps the category filter when a name search is supplied", async () => {
    vi.mocked(getPlaces).mockClear();
    const result = await search({ destination: "Kuala Lumpur", category: "Restaurant", search: "Jalan Alor", limit: 5 });
    expect(result.data.items?.map((place) => place.placeId)).toEqual([5]);
    expect(getPlaces).toHaveBeenCalledWith(expect.objectContaining({ category: "Restaurant", search: "Jalan Alor" }));
  });

  it("keeps a conflicting search term instead of silently dropping it", async () => {
    const result = await search({ destination: "Kuala Lumpur", category: "Restaurant", search: "hotel", limit: 5 });
    expect(result.data.items).toEqual([]);
    expect(getPlaces).toHaveBeenCalledWith(expect.objectContaining({ category: "Restaurant", search: "hotel" }));
  });

  it.each(["hotel", "accommodation", "lodging", "住宿", "酒店", "旅馆"])("normalizes %s to Accommodation", async (category) => {
    const result = await search({ category, limit: 5 });
    expect(result.data.items?.map((place) => place.placeId)).toEqual([6]);
  });

  it.each(["restaurant", "food", "dining", "餐厅", "餐廳", "美食"])("normalizes %s to Restaurant", async (category) => {
    const result = await search({ category, limit: 5 });
    expect(result.data.items?.map((place) => place.placeId)).toEqual([5]);
  });

  it("rejects a mismatched backend place before returning tool content", async () => {
    vi.mocked(getPlaces).mockResolvedValueOnce({ items: [fixtures.places[0]], pagination: { total: 1 } } as Awaited<ReturnType<typeof getPlaces>>);
    const result = await search({ category: "Accommodation", limit: 5 });
    expect(getPlaces).toHaveBeenCalled();
    expect(result.usage.status).toBe("error");
    expect(result.data.items).toBeUndefined();
  });

  it("continues to reject the Test category", async () => {
    const result = await search({ category: "Test", limit: 10 });
    expect(result.usage.status).toBe("error");
  });

  it.each([
    ["Attractions", ["Attraction", "Culture", "Historical", "Nature"]],
    ["Restaurant", ["Restaurant"]],
    ["Accommodation", ["Accommodation"]],
    ["Shopping", ["Shopping"]],
    [null, ["Accommodation", "Attraction", "Culture", "Historical", "Nature", "Restaurant", "Shopping"]],
  ] as const)("enforces the %s catalogue category invariant", async (category, allowed) => {
    const result = await search({ ...(category ? { category } : {}), limit: 10 });
    expect(result.usage.status).toBe("success");
    expect(result.data.items?.length).toBeGreaterThan(0);
    expect(result.data.items?.every((place) => allowed.includes(place.category as never))).toBe(true);
  });

  it("reports a timed-out place query as a tool error", async () => {
    vi.mocked(getPlaces).mockImplementationOnce(() => new Promise(() => undefined));
    const execution = await executeSearchPlacesTool({ search: "unknown", limit: 5 }, 1);
    expect(execution.usage).toMatchObject({ name: "search_places", status: "error", resultCount: 0 });
    expect(JSON.parse(execution.content).error.code).toBe("PLACE_SEARCH_FAILED");
  });
});
