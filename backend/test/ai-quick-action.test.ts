import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requestedCategory, requestsPersonalization } from "../src/modules/ai/ai.category.js";
import { aiToolBadge } from "../../src/lib/ai-tool-badge.js";

const assistantSource = readFileSync(new URL("../../src/pages/AIAssistant.tsx", import.meta.url), "utf8");

describe("assistant quick actions", () => {
  it("offers a restaurant catalogue query that does not trigger personalization refusal", () => {
    const foodAction = assistantSource.match(/title: "Find food recommendations",\s*prompt: "([^"]+)"/);
    expect(foodAction).not.toBeNull();
    const prompt = foodAction![1];
    expect(prompt).toBe("What restaurants are available in Penang?");
    expect(requestedCategory(prompt)).toBe("Restaurant");
    expect(requestsPersonalization(prompt)).toBe(false);
  });

  it("labels successful tools by what they actually used", () => {
    expect(aiToolBadge([{ name: "search_places", status: "success" }])).toBe("Used TravelMate catalogue search");
    expect(aiToolBadge([{ name: "get_personalized_recommendations", status: "success" }]))
      .toBe("Used TravelMate recommendations");
    expect(aiToolBadge([{ name: "search_places", status: "error" }])).toBeNull();
    expect(aiToolBadge([])).toBeNull();
    expect(assistantSource).not.toContain("Based on live TravelMate data");
    expect(assistantSource).toMatch(/chatMessage\.toolBadge\s*&&\s*\(/);
  });
});
