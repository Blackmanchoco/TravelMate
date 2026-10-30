import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ search: vi.fn(), personalized: vi.fn(), findNames: vi.fn() }));
vi.mock("../src/config/env.js", () => ({ env: { ollamaBaseUrl: "http://127.0.0.1:11434", ollamaModel: "qwen3:8b", ollamaTimeoutMs: 120_000 } }));
vi.mock("../src/modules/ai/ai.tools.js", () => ({
  aiToolDefinitions: [], executeSearchPlacesTool: mocks.search,
  executePersonalizedRecommendationsTool: mocks.personalized,
  findMentionedPublicPlaceNames: mocks.findNames,
}));

import { sendAIChat } from "../src/modules/ai/ai.service.js";

function modelCalls(argumentsValue: object, reply: string) {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ model: "qwen3:8b", done: true,
      message: { role: "assistant", content: "", tool_calls: [{ function: { name: "search_places", arguments: argumentsValue } }] } }), { status: 200 }))
    .mockResolvedValue(new Response(JSON.stringify({ model: "qwen3:8b", done: true,
      message: { role: "assistant", content: reply } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function searchResult(name: string) {
  return { content: JSON.stringify({ ok: true, items: [{ placeId: name === "Penang Hill" ? 7 : 8, name, destinationId: 2, category: "Nature", priceLevel: name === "Penang Hill" ? 3 : 2 }], resultCount: 1 }),
    usage: { name: "search_places", arguments: { search: name, limit: 1 }, status: "success", resultCount: 1, durationMs: 1 } };
}

beforeEach(() => {
  mocks.search.mockImplementation(async (args: { search: string }) => searchResult(args.search));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("named-place facts ignore a model-invented category", () => {
  it("routes Penang attractions to the sightseeing group despite a model-invented hotel category", async () => {
    mocks.findNames.mockResolvedValue([]);
    mocks.search.mockResolvedValue(searchResult("Penang Hill"));
    modelCalls({ destination: "Penang", category: "Accommodation", limit: 5 }, "Penang Hill is one place to visit in Penang.");

    const result = await sendAIChat("What attractions are available in Penang?", "owner");

    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ destination: "Penang", limit: 5 }), expect.any(Number));
    expect(mocks.search.mock.calls[0][0]).toHaveProperty("category", "Attractions");
    expect(result.reply).toContain("Penang Hill (Nature)");
    expect(result.suggestedPlaces).toEqual([{ placeId: 7, name: "Penang Hill", category: "Nature", destinationId: 2, suggestedSlot: null }]);
  });

  it("re-queries Penang Hill without the model's Attraction filter", async () => {
    mocks.findNames.mockResolvedValue(["Penang Hill"]);
    modelCalls({ search: "Penang Hill", category: "Attraction", limit: 5 }, "TravelMate 当前数据未说明 Penang Hill 的 UNESCO 身份，因此无法确认。");
    const result = await sendAIChat("Penang Hill 是不是 UNESCO 遗产？", "owner");
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ search: "Penang Hill", limit: 1 }), expect.any(Number));
    expect(mocks.search.mock.calls[0][0]).not.toHaveProperty("category");
    expect(result.toolsUsed).toHaveLength(1);
  });

  it("searches George Town by its catalogue name when the model passes an unsupported category", async () => {
    mocks.findNames.mockResolvedValue(["George Town"]);
    modelCalls({ category: "UNESCO", limit: 5 }, "TravelMate 的 George Town 描述提到 UNESCO 遗产区。");
    const result = await sendAIChat("TravelMate 数据中的 George Town 描述有没有提到 UNESCO 遗产？", "owner");
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ search: "George Town", limit: 1 }), expect.any(Number));
    expect(mocks.search.mock.calls[0][0]).not.toHaveProperty("category");
    expect(result.toolsUsed).toHaveLength(1);
  });

  it("queries both named places from the last user turn before a price comparison", async () => {
    mocks.findNames.mockResolvedValue(["Penang Hill", "Kek Lok Si Temple"]);
    const fetchMock = modelCalls({ search: "Penang Hill", category: "Attraction", limit: 1 }, "比较范围是 Penang 的景点。Kek Lok Si Temple 最便宜。");
    const result = await sendAIChat("这两个地方哪个 priceLevel 更低？请说明比较范围。", "owner", [
      { role: "user", content: "我在比较 Penang Hill 和 Kek Lok Si Temple。" },
      { role: "assistant", content: "可以按 TravelMate 当前数据比较这两个地点。" },
    ]);
    expect(mocks.search.mock.calls.map(([args]) => args.search)).toEqual(["Penang Hill", "Kek Lok Si Temple"]);
    expect(mocks.search.mock.calls.every(([args]) => !Object.hasOwn(args, "category"))).toBe(true);
    expect(result.toolsUsed).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.reply).toContain("本次比较仅限");
    expect(result.reply).toContain("Kek Lok Si Temple");
    expect(result.reply).toContain("更低");
    expect(result.reply).not.toContain("Penang 的景点");
  });

  it("does not compare a null price as zero or replace it with model wording", async () => {
    mocks.findNames.mockResolvedValue(["Penang Hill", "Kek Lok Si Temple"]);
    mocks.search.mockImplementation(async (args: {search:string}) => {
      const value = searchResult(args.search);
      const data = JSON.parse(value.content);
      if (args.search === "Penang Hill") data.items[0].priceLevel = null;
      return {...value, content:JSON.stringify(data)};
    });
    modelCalls({search:"Penang Hill"}, "Penang Hill is cheapest in Penang.");
    const result = await sendAIChat("Which of Penang Hill and Kek Lok Si Temple has a lower priceLevel?", "owner");
    expect(result.reply).toMatch(/unknown|unavailable/i);
    expect(result.reply).not.toMatch(/cheapest| is lower/i);
  });

  it("reports ties honestly within the named set", async () => {
    mocks.findNames.mockResolvedValue(["Penang Hill", "Kek Lok Si Temple"]);
    mocks.search.mockImplementation(async (args: {search:string}) => {
      const value=searchResult(args.search); const data=JSON.parse(value.content);
      data.items[0].priceLevel=2; return {...value,content:JSON.stringify(data)};
    });
    modelCalls({}, "Kek Lok Si Temple is cheaper.");
    const result=await sendAIChat("Compare the priceLevel of Penang Hill and Kek Lok Si Temple", "owner");
    expect(result.reply).toMatch(/same priceLevel/i);
    expect(result.reply).toMatch(/only/i);
  });

  it("does not use a different place returned by a fuzzy name search", async () => {
    mocks.findNames.mockResolvedValue(["Penang Hill", "Kek Lok Si Temple"]);
    mocks.search.mockResolvedValue(searchResult("Unrelated Place"));
    modelCalls({}, "Unrelated Place is cheaper.");
    const result=await sendAIChat("Compare priceLevel for Penang Hill and Kek Lok Si Temple", "owner");
    expect(result.reply).toContain("unknown");
    expect(result.reply).not.toContain("Unrelated Place");
    expect(result.suggestedPlaces).toEqual([]);
  });
});
