import { describe, expect, it } from "vitest";

import { requestedCategory } from "../src/modules/ai/ai.category.js";

describe("deterministic category intent", () => {
  it.each([
    ["restarant", "Restaurant"],
    ["restaurent", "Restaurant"],
    ["resturant", "Restaurant"],
    ["restraunt", "Restaurant"],
    ["hotle", "Accommodation"],
    ["hotell", "Accommodation"],
    ["acomodation", "Accommodation"],
    ["accomodation", "Accommodation"],
    ["hostel", "Accommodation"],
    ["motel", "Accommodation"],
    ["guesthouse", "Accommodation"],
    ["homestay", "Accommodation"],
    ["lodging", "Accommodation"],
    ["resort", "Accommodation"],
  ] as const)("matches %s to %s", (word, category) => {
    expect(requestedCategory(`Any ${word} in Penang?`)).toBe(category);
  });

  it.each([
    "any food in Penang",
    "where to eat in Penang",
  ])("recognizes restaurant intent in %s", (message) => {
    expect(requestedCategory(message)).toBe("Restaurant");
  });

  it.each([
    "hostile weather in Penang",
    "hotter days in Penang",
    "restful places in Penang",
    "show the model report",
    "diving in Penang",
    "logging an itinerary",
    "we may resort to another plan",
    "find a good place in Penang",
  ])("does not mistake %s for a place category", (message) => {
    expect(requestedCategory(message)).toBeNull();
  });

  it("keeps exact short tokens and two requested categories distinct", () => {
    expect(requestedCategory("good places in Penang")).toBeNull();
    expect(requestedCategory("food places in Penang")).toBe("Restaurant");
    expect(requestedCategory("hotel and restarant in Penang")).toBe("multiple");
  });
});
