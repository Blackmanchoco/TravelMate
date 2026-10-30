import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ personalized: vi.fn(), search: vi.fn() }));
vi.mock("../src/config/env.js", () => ({ env: { ollamaBaseUrl: "http://127.0.0.1:11434", ollamaModel: "qwen3:8b", ollamaTimeoutMs: 120_000 } }));
vi.mock("../src/modules/ai/ai.tools.js", () => ({
  aiToolDefinitions: [], executePersonalizedRecommendationsTool: mocks.personalized,
  executeSearchPlacesTool: mocks.search,
}));

import { sendAIChat } from "../src/modules/ai/ai.service.js";

function setup(reply: string) {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ model: "qwen3:8b", done: true,
      message: { role: "assistant", content: "", tool_calls: [{ function: { name: "get_personalized_recommendations", arguments: { limit: 5 } } }] } }), { status: 200 }))
    .mockResolvedValue(new Response(JSON.stringify({ model: "qwen3:8b", done: true,
      message: { role: "assistant", content: reply } }), { status: 200 })));
  mocks.personalized.mockResolvedValue({ content: JSON.stringify({ ok: true, items: [
    { placeId: 3, destinationId: 1, name: "Sunset Garden", category: "Nature", activityTypes: ["nature"], tags: ["sunset"] },
  ] }), usage: { name: "get_personalized_recommendations", arguments: { limit: 5 }, status: "success", resultCount: 1, durationMs: 1 } });
}

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("assistant schedule suggestion safety", () => {
  it("replaces model-written English day and time with a structured slot", async () => {
    setup("Visit Sunset Garden on Day 2 in the Morning.");
    const result = await sendAIChat("Recommend places for me", "owner");
    expect(result.reply).not.toMatch(/Day 2|Morning/);
    expect(result.suggestedPlaces).toEqual([{ placeId: 3, destinationId: 1, name: "Sunset Garden", category: "Nature", suggestedSlot: "Evening" }]);
  });

  it("replaces model-written Chinese day and time", async () => {
    setup("第二天早上去 Sunset Garden。");
    const result = await sendAIChat("根据我的偏好推荐地点", "owner");
    expect(result.reply).not.toMatch(/第二天|早上/);
    expect(result.reply).toContain("Sunset Garden");
  });
});
