import { describe, expect, it } from "vitest";

import { daysInDateSpan, invalidScheduledDays, nextOrderInSlot } from "../src/modules/itineraries/itinerary-schedule.js";

describe("itinerary schedule rules", () => {
  const start = new Date("2026-10-14T00:00:00.000Z");
  const end = new Date("2026-10-16T00:00:00.000Z");

  it("counts the inclusive calendar date span", () => {
    expect(daysInDateSpan(start, end)).toBe(3);
    expect(daysInDateSpan(start, start)).toBe(1);
    expect(daysInDateSpan(start, null)).toBeNull();
  });

  it("finds existing days outside a changed span without hiding legacy data", () => {
    expect(invalidScheduledDays([1, 2, 3, 3], start, start)).toEqual([2, 3]);
    expect(invalidScheduledDays([1, 2, 3], null, end)).toEqual([]);
  });

  it("reports zero and negative legacy days when a date range changes", () => {
    expect(invalidScheduledDays([0, -2, 1, 4, 0], start, end)).toEqual([-2, 0, 4]);
  });

  it("appends inside an occupied slot rather than skipping it", () => {
    expect(nextOrderInSlot([
      { day: 1, timeSlot: "Morning", order: 1 },
      { day: 1, timeSlot: "Morning", order: 3 },
      { day: 1, timeSlot: "Evening", order: 4 },
    ], 1, "Morning")).toBe(4);
  });
});
