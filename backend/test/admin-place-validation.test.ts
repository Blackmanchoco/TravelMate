import { describe, expect, it } from "vitest";
import { isProtectedPlace, isRestorablePlace } from "../src/modules/admin/admin-place-protection.js";
import { normalizeDisplayTags, parseCreatePlaceInput, validSourceUrl, withinMalaysia } from "../src/modules/admin/admin-place-validation.js";

const categories = ["Attraction", "Culture", "Historical", "Nature", "Restaurant", "Shopping"];
const valid = {
  destinationId: 1, name: "  C1 Sample  ", category: "Attraction",
  description: "A temporary place", address: "Kuala Lumpur",
  latitude: 3.139, longitude: 101.687, priceLevel: 4,
  sourceUrl: "https://example.invalid/place",
  tags: ["culture", "culture"], activityTypes: ["walking"],
  travelStyleTags: ["cultural"], displayTags: ["  Café  Walk  ", "cafe-walk", "Night__Market"],
};

describe("Admin Place input", () => {
  it("normalizes Unicode display labels, separators, duplicates and limit", () => {
    expect(normalizeDisplayTags(valid.displayTags)).toEqual(["café-walk", "cafe-walk", "night-market"]);
    expect(normalizeDisplayTags(["ＡＢＣ !!! １２３", "abc-123"])).toEqual(["abc-123"]);
    expect(() => normalizeDisplayTags(Array.from({ length: 11 }, (_, i) => `tag-${i}`))).toThrow();
    expect(() => normalizeDisplayTags(["x".repeat(65)])).toThrow();
  });
  it("rejects URL credentials, whitespace, other schemes and oversized values", () => {
    expect(validSourceUrl(valid.sourceUrl)).toBe(true);
    for (const url of ["ftp://example.invalid", ["https://user:secret", "@", "example.invalid"].join(""), "https://example.invalid/a b", "https://example.invalid/" + "a".repeat(2048)]) {
      expect(validSourceUrl(url)).toBe(false);
    }
  });
  it("checks finite coordinates within named Malaysia bounds", () => {
    expect(withinMalaysia(3.139, 101.687)).toBe(true);
    for (const pair of [[0.79, 101], [3, 119.51], [Infinity, 101], [3, NaN]]) {
      expect(withinMalaysia(pair[0], pair[1])).toBe(false);
    }
  });
  it("accepts only named fields, existing categories and vocabulary values", () => {
    expect(parseCreatePlaceInput(valid, categories)).toMatchObject({ name: "C1 Sample", tags: ["culture"] });
    for (const input of [
      { ...valid, id: 99 }, { ...valid, deletedAt: null }, { ...valid, category: "tEsT" },
      { ...valid, category: "New" }, { ...valid, priceLevel: 0 },
      { ...valid, tags: [] }, { ...valid, activityTypes: ["unknown"] },
      { ...valid, destinationId: 0 }, { ...valid, description: " " },
    ]) expect(() => parseCreatePlaceInput(input, categories)).toThrow();
  });
});

describe("Admin Place protection", () => {
  it("protects historical IDs and Test regardless of case", () => {
    for (const id of [31, 66, 67, 68, 69, 70, 71]) expect(isProtectedPlace({ id, category: "Attraction" })).toBe(true);
    expect(isProtectedPlace({ id: 99, category: "tEsT" })).toBe(true);
    expect(isProtectedPlace({ id: 99, category: "Nature" })).toBe(false);
    expect(isRestorablePlace({ id: 99, category: "Nature", deletedAt: new Date() })).toBe(true);
    expect(isRestorablePlace({ id: 66, category: "Nature", deletedAt: new Date() })).toBe(false);
    expect(isRestorablePlace({ id: 99, category: "Nature", deletedAt: null })).toBe(false);
  });
});
