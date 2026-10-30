import { describe, expect, it } from "vitest";
import { formatEstimatedCost, groupPrintDays } from "../../src/pages/print/print-itinerary-model";
import type { ItineraryItem } from "../../src/types/itinerary";

function item(id: number, day: number, timeSlot: ItineraryItem["timeSlot"], order: number): ItineraryItem {
  return { id, day, timeSlot, order, itineraryId: 99, placeId: 7, notes: null, estimatedDuration: null,
    place: { id: 7, destinationId: 1, name: "Same place", category: "Culture", description: "", address: "Address",
      latitude: 1, longitude: 100, rating: null, priceLevel: 1, imageUrl: null } };
}

describe("print itinerary model", () => {
  it("preserves separate occurrences of a repeated place in day and time-slot order", () => {
    const days = groupPrintDays([
      item(20, 2, "Evening", 1), item(30, 1, "Afternoon", 2),
      item(10, 1, "Morning", 1), item(31, 1, "Afternoon", 1),
    ]);
    expect(days.map((day) => day.day)).toEqual([1, 2]);
    expect(days[0].items.map((entry) => entry.id)).toEqual([10, 31, 30]);
    expect(days.flatMap((day) => day.items)).toHaveLength(4);
  });

  it("labels incomplete ranges as known costs only", () => {
    expect(formatEstimatedCost({ min: 30, max: 70 }, false)).toBe("Estimated known costs only: RM 30–70");
    expect(formatEstimatedCost({ min: 30, max: 70 }, true)).toBe("Estimated cost: RM 30–70");
  });
});
