import { describe, expect, it } from "vitest";

import { allowedItineraryDays, suggestedPosition } from "../../src/lib/itinerary-add-position";

describe("assistant add position", () => {
  it("limits a dated itinerary to its inclusive span", () => {
    expect(allowedItineraryDays("2026-10-14", "2026-10-14", [1, 2])).toEqual([1]);
  });

  it("offers a bounded default for an undated itinerary", () => {
    expect(allowedItineraryDays(null, null, [5])).toEqual([1, 2, 3, 4, 5]);
    expect(allowedItineraryDays(null, null, [])).toEqual([1, 2, 3]);
  });

  it("uses the hinted slot when free and appends when occupied", () => {
    const items = [{ day: 1, timeSlot: "Evening" as const, order: 1 }];
    expect(suggestedPosition(items, [1, 2], "Evening")).toEqual({ day: 2, timeSlot: "Evening", order: 1, occupied: false });
    expect(suggestedPosition(items, [1], "Evening")).toEqual({ day: 1, timeSlot: "Evening", order: 2, occupied: true });
  });

  it("defaults to first empty slot in day and time order", () => {
    const items = [{ day: 1, timeSlot: "Morning" as const, order: 1 }];
    expect(suggestedPosition(items, [1], null)).toEqual({ day: 1, timeSlot: "Afternoon", order: 1, occupied: false });
  });
});
