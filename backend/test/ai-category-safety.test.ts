import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ search: vi.fn(), personalized: vi.fn() }));

vi.mock("../src/config/env.js", () => ({
  env: { ollamaBaseUrl: "http://127.0.0.1:11434", ollamaModel: "qwen3:8b", ollamaTimeoutMs: 120_000 },
}));
vi.mock("../src/modules/ai/ai.tools.js", () => ({
  aiToolDefinitions: [],
  executeSearchPlacesTool: mocks.search,
  executePersonalizedRecommendationsTool: mocks.personalized,
  findMentionedPublicPlaceNames: vi.fn().mockResolvedValue([]),
}));

import { sendAIChat } from "../src/modules/ai/ai.service.js";
import { formatCategoryReply, requestedCategory } from "../src/modules/ai/ai.category.js";

function modelCall(tool: "search_places" | "get_personalized_recommendations" | null, argumentsValue: object = {}, reply = "George Town is a hotel.") {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      model: "qwen3:8b", done: true,
      message: {
        role: "assistant", content: tool ? "" : reply,
        ...(tool ? { tool_calls: [{ function: { name: tool, arguments: argumentsValue } }] } : {}),
      },
    }), { status: 200 }))
    .mockResolvedValue(new Response(JSON.stringify({
      model: "qwen3:8b", done: true,
      message: { role: "assistant", content: reply },
    }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function searchResult(items: Array<{ placeId: number; name: string; destinationId: number; category: string }>, destination: string, availableCategories: string[] = []) {
  return {
    content: JSON.stringify({
      ok: true, destination: { id: destination === "Penang" ? 2 : 1, name: destination },
      items, resultCount: items.length, totalMatches: items.length, availableCategories,
    }),
    usage: {
      name: "search_places" as const, arguments: { limit: 5 },
      status: "success" as const, resultCount: items.length, durationMs: 1,
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("category-safe assistant replies", () => {
  it.each([
    ["Penang hotels, 3 days", "Accommodation"],
    ["Penang restaurants for a 2-day trip", "Restaurant"],
    ["Penang hotle for 3 dyas", "Accommodation"],
    ["Penang restuarant for 3 dasy", "Restaurant"],
    ["Penang hotel for 3 dya", "Accommodation"],
    ["Penang hotel and plann a trip itinerary", "Accommodation"],
    ["Penang restaurant and planing a trip", "Restaurant"],
    ["Penang hotel for three days", "Accommodation"],
    ["\u69df\u57ce\u9152\u5e97\uff0c\u4e09\u5929\u884c\u7a0b", "Accommodation"],
    ["\u69df\u57ce\u9910\u5385\uff0c3\u65e5", "Restaurant"],
    ["\u69df\u57ce\u9152\u5e97\uff0c\uff13\u5929", "Accommodation"],
  ])("adds exactly one fixed limitation for trip-length compound %s", async (message, category) => {
    modelCall(null, {}, "Invented Palace at 09:00 on Day 1.");
    mocks.search.mockResolvedValue(searchResult([
      { placeId: 52, name: "Catalogue Match", destinationId: 2, category },
    ], "Penang"));
    const result = await sendAIChat(message, "test-user");
    const base = formatCategoryReply({ category: category as "Accommodation" | "Restaurant",
      destination: "Penang", names: ["Catalogue Match"], totalMatches: 1, availableCategories: [],
      chinese: /[\u3400-\u9fff]/u.test(message) });
    const ending = /[\u3400-\u9fff]/u.test(message)
      ? "\u804a\u5929\u65e0\u6cd5\u7f16\u6392\u884c\u7a0b\uff1b\u8bf7\u4f7f\u7528 Itinerary \u548c Add \u9009\u62e9\u65e5\u671f\u548c\u65f6\u6bb5\u3002"
      : "This chat cannot build a schedule; use Itinerary and Add to choose days and slots.";
    expect(result.reply).toBe(`${base}\n\n${ending}`);
    expect(result.reply.split(ending)).toHaveLength(2);
    expect(result.suggestedPlaces).toEqual([]);
    expect(result.reply).not.toMatch(/Invented Palace|09:00|Day 1/);
  });

  it.each([
    ["Penang hotel", "Accommodation"],
    ["Penang restaurants", "Restaurant"],
    ["Penang hotel for 3 nights", "Accommodation"],
    ["Penang restaurants during a 3 night stay", "Restaurant"],
    ["Penang hotel for 3 nights, no schedule", "Accommodation"],
    ["Penang hotel costs 3 dollars", "Accommodation"],
    ["Penang hotel has 3 daylight windows", "Accommodation"],
    ["Penang hotel opened 3 days ago", "Accommodation"],
    ["Penang restaurant opens 3 days per week", "Restaurant"],
    ["Penang attractions, 3 days", "Historical"],
    ["\u69df\u57ce\u9152\u5e97\uff0c3\u665a", "Accommodation"],
    ["\u69df\u57ce\u9152\u5e97\uff0c3\u67083\u65e5", "Accommodation"],
    ["\u69df\u57ce\u9152\u5e97\uff0c3\u6708 3\u65e5\u5165\u4f4f", "Accommodation"],
    ["\u69df\u57ce\u9152\u5e97\uff0c10 \u6708 18 \u65e5\u5165\u4f4f", "Accommodation"],
    ["\u69df\u57ce\u9152\u5e97\uff0c\u4e09\u6708\u4e8c\u5341\u4e09\u65e5\u5165\u4f4f", "Accommodation"],
  ])("preserves non-compound and stay-length reply exactly for %s", async (message, category) => {
    modelCall(null);
    mocks.search.mockResolvedValue(searchResult([
      { placeId: 52, name: "Catalogue Match", destinationId: 2, category },
    ], "Penang"));
    const result = await sendAIChat(message, "test-user");
    const expected = formatCategoryReply({ category: category === "Historical" ? "Attractions" : category as "Accommodation" | "Restaurant",
      destination: "Penang", names: [category === "Historical" ? "Catalogue Match (Historical)" : "Catalogue Match"],
      totalMatches: 1, availableCategories: [], chinese: /[\u3400-\u9fff]/u.test(message) });
    expect(result.reply).toBe(expected);
  });

  it.each([
    ["Show Penang attractions and build a two-day itinerary", "This chat cannot build a schedule; use Itinerary and Add to choose days and slots."],
    ["列出槟城景点，然后安排两天行程", "聊天无法编排行程；请使用 Itinerary 和 Add 选择日期和时段。"],
    ["Show Penang attractions，然后安排两天行程", "聊天无法编排行程；请使用 Itinerary 和 Add 选择日期和时段。"],
  ])("keeps the catalogue and appends the schedule limitation for %s", async (message, ending) => {
    modelCall(null, {}, "Invented Palace at 09:00 on Day 1.");
    mocks.search.mockResolvedValue(searchResult([
      { placeId: 52, name: "Blue Mansion", destinationId: 2, category: "Historical" },
    ], "Penang"));
    const result = await sendAIChat(message, "test-user");
    expect(result.reply).toContain("Blue Mansion (Historical)");
    expect(result.reply.endsWith(ending)).toBe(true);
    expect(result.reply.split(ending)).toHaveLength(2);
    expect(result.reply).not.toMatch(/Invented Palace|09:00|Day 1/);
    expect(result.suggestedPlaces.map((place) => place.placeId)).toEqual([52]);
  });

  it("uses live catalogue rows when a tool-free model invents a compound schedule", async () => {
    modelCall(null, {}, "Invented Palace at 09:00 on Day 1.");
    mocks.search.mockResolvedValue(searchResult([
      { placeId: 52, name: "Blue Mansion", destinationId: 2, category: "Historical" },
      { placeId: 112, name: "Chulia Court", destinationId: 2, category: "Restaurant" },
    ], "Penang"));
    const result = await sendAIChat("Show places in Penang and make a two-day itinerary", "test-user");
    expect(result.reply).toContain("Blue Mansion (Historical)");
    expect(result.reply).toContain("Chulia Court (Restaurant)");
    expect(result.reply).toMatch(/cannot build a schedule; use Itinerary and Add/);
    expect(result.reply).not.toMatch(/Invented Palace|09:00|Day 1/);
    expect(result.suggestedPlaces.map((place) => place.placeId)).toEqual([52, 112]);
  });

  it("keeps an empty catalogue honest in a compound request", async () => {
    modelCall(null);
    mocks.search.mockResolvedValue(searchResult([], "Melaka"));
    const result = await sendAIChat("Show Melaka restaurants and build a schedule", "test-user");
    expect(result.reply).toContain("No restaurants are currently listed in Melaka.");
    expect(result.reply).toMatch(/cannot build a schedule; use Itinerary and Add/);
    expect(result.suggestedPlaces).toEqual([]);
  });

  it("does not add a schedule limitation to an ordinary category request", async () => {
    modelCall(null);
    mocks.search.mockResolvedValue(searchResult([
      { placeId: 52, name: "Blue Mansion", destinationId: 2, category: "Historical" },
    ], "Penang"));
    const result = await sendAIChat("Show Penang attractions", "test-user");
    expect(result.reply).toContain("Blue Mansion");
    expect(result.reply).not.toMatch(/cannot build|Itinerary and Add/);
  });

  it.each([
    "Penang attractions", "things to do in Kuala Lumpur", "places to visit in Melaka",
    "what to see in Penang", "sightseeing in Penang", "attractions in Penang",
    "槟城景点", "吉隆坡有什么好玩", "马六甲去哪里玩",
    "atracions in Penang",
  ])("recognizes sightseeing intent in %s", (message) => {
    expect(requestedCategory(message)).toBe("Attractions");
  });

  it.each(["shopping in Penang", "槟城购物", "shoping in Melaka"])("keeps shopping separate in %s", (message) => {
    expect(requestedCategory(message)).toBe("Shopping");
  });

  it("rejects a restaurant leaked into an attraction result before reply or Add cards", async () => {
    modelCall("search_places", { destination: "Penang", limit: 5 });
    mocks.search.mockResolvedValue(searchResult([
      { placeId: 52, name: "Blue Mansion", destinationId: 2, category: "Historical" },
      { placeId: 112, name: "Chulia Court", destinationId: 2, category: "Restaurant" },
    ], "Penang"));
    const result = await sendAIChat("Penang attractions", "test-user");
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ category: "Attractions" }), expect.any(Number));
    expect(result.reply).not.toMatch(/Chulia Court|Blue Mansion/);
    expect(result.suggestedPlaces).toEqual([]);
  });

  it("uses only sight categories in the attraction reply and Add cards", async () => {
    modelCall("search_places", { destination: "Penang", limit: 5 }, "Chulia Court is an attraction and Example Stay is a sight.");
    mocks.search.mockResolvedValue(searchResult([
      { placeId: 52, name: "Blue Mansion", destinationId: 2, category: "Historical" },
      { placeId: 7, name: "Penang Hill", destinationId: 2, category: "Nature" },
    ], "Penang"));
    const result = await sendAIChat("Penang attractions", "test-user");
    expect(result.reply).toContain("Blue Mansion (Historical)");
    expect(result.reply).toContain("Penang Hill (Nature)");
    expect(result.reply).not.toMatch(/Chulia Court|Example Stay/);
    expect(result.suggestedPlaces.map((place) => place.category)).toEqual(["Historical", "Nature"]);
  });

  it("labels every mixed unrestricted result and Add card with its stored category", async () => {
    modelCall("search_places", { destination: "Penang", limit: 5 }, "Blue Mansion and Chulia Court are attractions.");
    mocks.search.mockResolvedValue(searchResult([
      { placeId: 52, name: "Blue Mansion", destinationId: 2, category: "Historical" },
      { placeId: 112, name: "Chulia Court", destinationId: 2, category: "Restaurant" },
    ], "Penang"));
    const result = await sendAIChat("What places are in Penang?", "test-user");
    expect(result.reply).toContain("Blue Mansion (Historical)");
    expect(result.reply).toContain("Chulia Court (Restaurant)");
    expect(result.reply).not.toContain("are attractions");
    expect(result.suggestedPlaces.map((place) => place.category)).toEqual(["Historical", "Restaurant"]);
  });

  it.each([
    ["Penang attractions", "Historical", "Restaurant"],
    ["Penang restaurants", "Restaurant", "Accommodation"],
    ["Penang hotels", "Accommodation", "Shopping"],
    ["Penang shopping", "Shopping", "Nature"],
  ])("rejects a wrong-category result for %s before reply and Add cards", async (message, allowed, forbidden) => {
    modelCall("search_places", { destination: "Penang", limit: 5 });
    mocks.search.mockResolvedValue(searchResult([
      { placeId: 1, name: "Allowed Place", destinationId: 2, category: allowed },
      { placeId: 2, name: "Forbidden Place", destinationId: 2, category: forbidden },
    ], "Penang"));
    const result = await sendAIChat(message, "test-user");
    expect(result.reply).not.toContain("Forbidden Place");
    expect(result.suggestedPlaces).toEqual([]);
  });
  it.each([
    "槟城有什么餐厅？",
    "槟城有什么美食？",
    "吉隆坡有什么餐廳？",
    "吉隆坡有什么美食？",
  ])("recognizes Chinese restaurant and food intent in %s", (message) => {
    expect(requestedCategory(message)).toBe("Restaurant");
  });

  it("labels a partial category list instead of implying every match was shown", () => {
    expect(formatCategoryReply({
      category: "Restaurant", destination: "Kuala Lumpur", names: ["Jalan Alor"],
      totalMatches: 3, availableCategories: [], chinese: false,
    })).toContain("lists 3 restaurants in Kuala Lumpur. Showing 1: Jalan Alor");
  });

  it("routes the typo hotel recommendation prompt away from the unrestricted recommender", async () => {
    const fetchMock = modelCall("get_personalized_recommendations", { destination: "Penang", limit: 5 });
    mocks.search.mockResolvedValue(searchResult([], "Penang", ["Culture", "Historical", "Nature", "Shopping"]));

    const result = await sendAIChat("Have any hotel recommed for the penang", "test-user");

    expect(mocks.personalized).not.toHaveBeenCalled();
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ destination: "Penang", category: "Accommodation" }), expect.any(Number));
    expect(result.reply).toBe("No hotels are currently listed in Penang. Available categories there: Culture, Historical, Nature, Shopping.");
    expect(result.toolsUsed.map((tool) => tool.name)).toEqual(["search_places"]);
    expect(result.suggestedPlaces).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("answers a Chinese hotel request with the actual empty category result", async () => {
    modelCall("search_places", { search: "George Town", limit: 5 });
    mocks.search.mockResolvedValue(searchResult([], "Penang", ["Culture", "Historical", "Nature", "Shopping"]));

    const result = await sendAIChat("槟城有酒店推荐吗？", "test-user");

    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ destination: "Penang", category: "Accommodation" }), expect.any(Number));
    expect(result.reply).toMatch(/^Penang 目前没有收录酒店。/);
    expect(result.reply).toContain("Culture、Historical、Nature、Shopping");
    expect(result.reply).not.toContain("George Town");
  });

  it("reports zero Penang restaurants without naming another place", async () => {
    modelCall("search_places", { destination: "Penang", search: "food" });
    mocks.search.mockResolvedValue(searchResult([], "Penang", ["Culture", "Historical", "Nature", "Shopping"]));

    const result = await sendAIChat("Any restaurants in Penang?", "test-user");

    expect(result.reply).toBe("No restaurants are currently listed in Penang. Available categories there: Culture, Historical, Nature, Shopping.");
    expect(result.suggestedPlaces).toEqual([]);
  });

  it("names only Jalan Alor for a Kuala Lumpur restaurant request", async () => {
    modelCall("search_places", { destination: "Kuala Lumpur", category: "Restaurant" });
    mocks.search.mockResolvedValue(searchResult([
      { placeId: 5, name: "Jalan Alor", destinationId: 1, category: "Restaurant" },
    ], "Kuala Lumpur"));

    const result = await sendAIChat("Recommend a restaurant in Kuala Lumpur", "test-user");

    expect(result.reply).toContain("Jalan Alor");
    expect(result.reply).toContain("catalogue");
    expect(result.reply).not.toContain("personalized recommendation");
    expect(mocks.personalized).not.toHaveBeenCalled();
    expect(result.suggestedPlaces).toEqual([]);
  });

  it("rejects a leaked wrong-category tool item before reply or suggestions", async () => {
    const fetchMock = modelCall("search_places", { destination: "Kuala Lumpur", category: "Restaurant" });
    mocks.search.mockResolvedValue(searchResult([
      { placeId: 5, name: "Jalan Alor", destinationId: 1, category: "Restaurant" },
      { placeId: 7, name: "Museum", destinationId: 1, category: "Culture" },
    ], "Kuala Lumpur"));

    const result = await sendAIChat("Restaurants in Kuala Lumpur", "test-user");

    expect(result.reply).not.toMatch(/Museum|Jalan Alor/);
    expect(result.reply).toMatch(/temporarily unavailable/i);
    expect(result.suggestedPlaces).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("forces category search when the model replies without a tool", async () => {
    modelCall(null);
    mocks.search.mockResolvedValue(searchResult([], "Penang", ["Culture", "Historical", "Nature", "Shopping"]));

    const result = await sendAIChat("Hotels in Penang?", "test-user");

    expect(result.reply).toMatch(/^No hotels are currently listed in Penang/);
    expect(result.reply).not.toContain("George Town");
    expect(mocks.search).toHaveBeenCalledOnce();
  });

  it("declines explicit category-specific personalization without using either tool", async () => {
    modelCall("get_personalized_recommendations", { destination: "Penang" });

    const result = await sendAIChat("Recommend restaurants in Penang based on my saved preferences", "test-user");

    expect(result.reply).toMatch(/category-specific personalization is unavailable/i);
    expect(mocks.personalized).not.toHaveBeenCalled();
    expect(mocks.search).not.toHaveBeenCalled();
    expect(result.suggestedPlaces).toEqual([]);
  });
});
