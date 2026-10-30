import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  personalized: vi.fn(),
}));

vi.mock("../src/config/env.js", () => ({
  env: { ollamaBaseUrl: "http://127.0.0.1:11434", ollamaModel: "qwen3:8b", ollamaTimeoutMs: 120_000 },
}));
vi.mock("../src/modules/ai/ai.tools.js", () => ({
  aiToolDefinitions: [],
  executeSearchPlacesTool: mocks.search,
  executePersonalizedRecommendationsTool: mocks.personalized,
  findMentionedPublicPlaceNames: vi.fn(async () => []),
}));

import { sendAIChat } from "../src/modules/ai/ai.service.js";

type ToolName = "search_places" | "get_personalized_recommendations";

function modelCall(tool: ToolName) {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      model: "qwen3:8b", done: true,
      message: { role: "assistant", content: "", tool_calls: [{ function: { name: tool, arguments: { limit: 5 } } }] },
    }), { status: 200 }))
    .mockResolvedValue(new Response(JSON.stringify({
      model: "qwen3:8b", done: true,
      message: { role: "assistant", content: "Invented Place should never appear." },
    }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function execution(tool: ToolName, status: "success" | "error", code?: string, count = 0) {
  return {
    content: JSON.stringify(status === "success"
      ? { ok: true, items: Array.from({ length: count }, () => ({ placeId: 1, name: "Museum", destinationId: 1 })) }
      : { ok: false, error: { code, message: "Tool failed." } }),
    usage: { name: tool, arguments: { limit: 5 }, status, resultCount: count, durationMs: 1, ...(code ? { errorCode: code } : {}) },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AI deterministic tool fallback", () => {
  it("calls the recommender when an explicit personalized schedule request gets a tool-free model reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: "qwen3:8b", done: true,
      message: { role: "assistant", content: "I can recommend places on Day 2 in the morning." },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    mocks.personalized.mockResolvedValue(execution("get_personalized_recommendations", "error", "NO_PREFERENCE_SET"));

    const result = await sendAIChat("Recommend places for me and put one on Day 2 in the morning.", "test-user");

    expect(result.toolsUsed).toMatchObject([{ name: "get_personalized_recommendations", errorCode: "NO_PREFERENCE_SET" }]);
    expect(result.reply).toMatch(/preferences.*set/i);
    expect(result.reply).not.toMatch(/Day 2|morning/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing preferences in Chinese", "根据我的偏好推荐", "NO_PREFERENCE_SET", /偏好.*设置/],
    ["missing preferences in English", "Recommend for me", "NO_PREFERENCE_SET", /preferences.*set/i],
    ["recommender failure", "根据偏好推荐", "PERSONALIZED_RECOMMENDATIONS_FAILED", /推荐服务.*暂不可用/],
    ["recommender timeout", "根据偏好推荐", "PERSONALIZED_RECOMMENDATIONS_FAILED", /稍后再试/],
  ])("stops after %s", async (_case, message, code, expected) => {
    const fetchMock = modelCall("get_personalized_recommendations");
    mocks.personalized.mockResolvedValue(execution("get_personalized_recommendations", "error", code));
    const result = await sendAIChat(message, "test-user");
    expect(result.reply).toMatch(expected);
    expect(result.reply).not.toMatch(/Museum|Place|双子塔/);
    expect(result.toolsUsed).toHaveLength(1);
    expect(result.toolsUsed[0]).toMatchObject({ status: "error", errorCode: code });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a fixed Chinese message for an empty search, including Korean or Japanese characters", async () => {
    const fetchMock = modelCall("search_places");
    mocks.search.mockResolvedValue(execution("search_places", "success"));
    const result = await sendAIChat("京都의 景点", "test-user");
    expect(result.reply).toMatch(/没有收录景点/);
    expect(result.reply).not.toContain("Invented Place");
    expect(result.toolsUsed).toMatchObject([{ status: "success", resultCount: 0 }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a fixed service message for a timed-out place search", async () => {
    const fetchMock = modelCall("search_places");
    mocks.search.mockResolvedValue(execution("search_places", "error", "PLACE_SEARCH_FAILED"));
    const result = await sendAIChat("Show places", "test-user");
    expect(result.reply).toMatch(/search.*temporarily unavailable/i);
    expect(result.reply).not.toContain("Invented Place");
    expect(result.toolsUsed).toMatchObject([{ status: "error" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still lets the model complete a successful tool answer", async () => {
    const fetchMock = modelCall("search_places");
    mocks.search.mockResolvedValue(execution("search_places", "success", undefined, 1));
    const result = await sendAIChat("Show places", "test-user");
    expect(result.reply).toBe("Invented Place should never appear.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
