import { describe, expect, it } from "vitest";

import { suggestedSlotForPlace } from "../src/modules/ai/ai.suggested-slot.js";

describe("deterministic suggested slot", () => {
  it("prefers evening tags over other signals", () => {
    expect(suggestedSlotForPlace(["hiking"], ["sunset viewpoint"])).toBe("Evening");
    expect(suggestedSlotForPlace(["夜市"], [])).toBe("Evening");
  });

  it("uses morning for hiking, nature and garden activities", () => {
    expect(suggestedSlotForPlace(["Nature"], [])).toBe("Morning");
    expect(suggestedSlotForPlace([], ["garden"])).toBe("Morning");
  });

  it("leaves unclassified places to the itinerary allocator", () => {
    expect(suggestedSlotForPlace(["museum"], ["history"])).toBeNull();
  });
});
