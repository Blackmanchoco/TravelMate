import { describe, expect, it } from "vitest";
import { calculatePreferenceMatch } from "../src/modules/itineraries/preference-match.calculation.js";

const preference = { interests: ["culture"], preferredActivities: [], travelStyle: null, budget: null };
const place = (id: number, tags: string[]) => ({ id, name: `Place ${id}`, tags, activityTypes: [], travelStyleTags: [], priceLevel: 1 });
const item = (id: number, where: ReturnType<typeof place>) => ({ id, place: where });

describe("calculatePreferenceMatch", () => {
  it("scores a matching canonical interest", () => {
    const result = calculatePreferenceMatch(preference, [item(1, place(1, ["heritage"]))]);
    expect(result.score).toBe(100);
    expect(result.breakdown?.places[0]?.dimensions.interests.matched).toEqual(["culture"]);
  });
  it("rejects preferences with no recognizable values", () => {
    expect(() => calculatePreferenceMatch({ ...preference, interests: ["unknown"] }, [item(1, place(1, ["culture"]))]))
      .toThrowError(expect.objectContaining({ code: "NO_MATCHABLE_PREFERENCE", statusCode: 422 }));
  });
  it("returns no score for an empty itinerary", () => {
    expect(calculatePreferenceMatch(preference, [])).toEqual({ score: null, reason: "NO_ITEMS", breakdown: null });
  });
  it("counts duplicate Place items as separate occurrences", () => {
    const shared = place(1, ["culture"]);
    const result = calculatePreferenceMatch(preference, [item(1, shared), item(2, shared), item(3, place(2, ["food"]))]);
    expect(result.score).toBe(67);
    expect(result.breakdown?.aggregation).toBe("ITEM_OCCURRENCE_AVERAGE");
    expect(result.breakdown?.itemCount).toBe(3);
    expect(result.breakdown?.places.map((entry) => entry.itineraryItemId)).toEqual([1, 2, 3]);
  });
  it("uses the configured 35/30/25/10 weights for a mixed preference", () => {
    const result = calculatePreferenceMatch(
      { interests: ["culture"], preferredActivities: ["hiking"], travelStyle: "family", budget: "low" },
      [item(1, { ...place(1, ["culture"]), activityTypes: ["walking"], travelStyleTags: ["luxury"], priceLevel: 4 })],
    );
    expect(result.score).toBe(35);
    expect(result.breakdown?.places[0]?.score).toBe(35);
    expect(result.breakdown?.weights).toEqual({ interests: 35, activities: 30, travelStyle: 25, budget: 10 });
  });
  it("penalizes price level four completely for a low-budget preference", () => {
    const result = calculatePreferenceMatch(
      { interests: [], preferredActivities: [], travelStyle: null, budget: "low" },
      [item(1, { ...place(1, []), priceLevel: 4 })],
    );
    expect(result.score).toBe(0);
    expect(result.breakdown?.places[0]?.dimensions.budget.score).toBe(0);
  });
});
