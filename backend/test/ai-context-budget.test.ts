import { describe, expect, it } from "vitest";

import { budgetOllamaMessages, MAX_DYNAMIC_CONTEXT_BYTES } from "../src/modules/ai/ai.context-budget.js";
import type { OllamaMessage } from "../src/modules/ai/ai.types.js";

const system: OllamaMessage = { role: "system", content: "Required system instruction" };

function longestMessages(latest: string): OllamaMessage[] {
  return [
    system,
    ...Array.from({ length: 6 }, (_, index): OllamaMessage => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: "历史 context ".repeat(100).slice(0, 1_000),
    })),
    { role: "user", content: latest },
  ];
}

describe("Ollama context budget", () => {
  it.each([
    ["Chinese", "吉隆坡文化景点".repeat(500).slice(0, 4_000)],
    ["English", "TravelMate places ".repeat(300).slice(0, 4_000)],
  ])("keeps the system instruction and bounds longest %s input", (_name, latest) => {
    const result = budgetOllamaMessages(longestMessages(latest), 7);
    expect(result.messages[0]).toEqual(system);
    expect(result.messages.some((message) => message.role === "user")).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(result.messages.slice(1)), "utf8"))
      .toBeLessThanOrEqual(MAX_DYNAMIC_CONTEXT_BYTES);
    expect(result.pruned).toBe(true);
  });

  it("bounds a tool turn with ten long place descriptions", () => {
    const items = Array.from({ length: 10 }, (_, index) => ({
      placeId: index + 1,
      name: `Place ${index + 1}`,
      description: "文化 historical place ".repeat(120),
    }));
    const messages: OllamaMessage[] = [
      system,
      { role: "user", content: "Show me places" },
      { role: "assistant", content: "", tool_calls: [{ function: { name: "search_places", arguments: { limit: 10 } } }] },
      { role: "tool", tool_name: "search_places", content: JSON.stringify({ ok: true, items, resultCount: 10 }) },
    ];
    const result = budgetOllamaMessages(messages, 1);
    expect(result.messages[0]).toEqual(system);
    expect(Buffer.byteLength(JSON.stringify(result.messages.slice(1)), "utf8"))
      .toBeLessThanOrEqual(MAX_DYNAMIC_CONTEXT_BYTES);
    expect(result.toolItemsDropped + result.descriptionsTrimmed).toBeGreaterThan(0);
    const returned = JSON.parse(result.messages.at(-1)?.content ?? "{}") as { items?: unknown[] };
    expect(returned.items?.length).toBeGreaterThanOrEqual(1);
  });

  it("retains a tool result item when a long latest message needs trimming", () => {
    const messages: OllamaMessage[] = [
      system,
      { role: "user", content: "私密问题".repeat(1_000) },
      { role: "assistant", content: "", tool_calls: [{ function: { name: "search_places", arguments: { limit: 10 } } }] },
      { role: "tool", tool_name: "search_places", content: JSON.stringify({
        ok: true,
        items: Array.from({ length: 10 }, (_, index) => ({ placeId: index + 1, name: `Place ${index + 1}`, description: "地点简介".repeat(500) })),
      }) },
    ];
    const result = budgetOllamaMessages(messages, 1);
    const returned = JSON.parse(result.messages.at(-1)?.content ?? "{}") as { items?: unknown[] };
    expect(returned.items?.length).toBeGreaterThanOrEqual(1);
    expect(result.latestCharactersDropped).toBeGreaterThan(0);
    expect(Buffer.byteLength(JSON.stringify(result.messages.slice(1)), "utf8"))
      .toBeLessThanOrEqual(MAX_DYNAMIC_CONTEXT_BYTES);
  });

  it("preserves the latest question suffix while trimming a long prompt", () => {
    const suffix = "Which Penang restaurant is in the catalogue?";
    const result = budgetOllamaMessages(longestMessages("long context ".repeat(800) + suffix), 7);
    const latest = result.messages.filter((message) => message.role === "user").at(-1)?.content;
    expect(result.latestCharactersDropped).toBeGreaterThan(0);
    expect(latest).toContain(suffix);
    expect(latest?.endsWith(suffix)).toBe(true);
  });

  it("keeps two recent turns and ten ordinary places without pruning", () => {
    const items = Array.from({ length: 10 }, (_, index) => ({
      placeId: index + 1,
      name: `Place ${index + 1}`,
      destinationId: 2,
      category: "Culture",
      description: "d".repeat(100),
      address: "a".repeat(75),
      latitude: 5.4,
      longitude: 100.3,
      rating: 4.5,
      priceLevel: 1,
    }));
    const messages: OllamaMessage[] = [
      system,
      { role: "user", content: "I enjoy cultural places." },
      { role: "assistant", content: "I can search the live catalogue." },
      { role: "user", content: "We will visit Penang." },
      { role: "assistant", content: "I will look there." },
      { role: "user", content: "Which places should we explore?" },
      { role: "assistant", content: "", tool_calls: [{ function: { name: "search_places", arguments: { destination: "Penang", limit: 10 } } }] },
      { role: "tool", tool_name: "search_places", content: JSON.stringify({
        ok: true,
        evidencePolicy: "Use only returned fields",
        query: { destination: "Penang", limit: 10 },
        destination: { id: 2, name: "Penang", city: "George Town", state: "Penang" },
        items,
        resultCount: 10,
        totalMatches: 13,
      }) },
    ];
    const result = budgetOllamaMessages(messages, 5);
    const tool = JSON.parse(result.messages.at(-1)?.content ?? "{}") as { items?: unknown[] };
    expect(tool.items).toHaveLength(10);
    expect(result.historyMessagesDropped).toBe(0);
    expect(result.latestCharactersDropped).toBe(0);
    expect(result.pruned).toBe(false);
  });
});
