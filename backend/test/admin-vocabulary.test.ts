import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ADMIN_VOCABULARY } from "../src/modules/admin/admin-vocabulary.js";
import { calculatePreferenceMatch } from "../src/modules/itineraries/preference-match.calculation.js";

const source = ts.createSourceFile(
  "preference-match.calculation.ts",
  readFileSync(new URL("../src/modules/itineraries/preference-match.calculation.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);

function canonicalKeys(declarationName: string) {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(source) !== declarationName) continue;
      const call = declaration.initializer;
      if (!call || !ts.isCallExpression(call) || !ts.isObjectLiteralExpression(call.arguments[0])) {
        throw new Error(`Cannot inspect ${declarationName}`);
      }
      return call.arguments[0].properties.map((property) => property.name?.getText(source)).sort();
    }
  }
  throw new Error(`Missing ${declarationName}`);
}

const basePlace = { id: 1, name: "Fixture", tags: [], activityTypes: [], travelStyleTags: [], priceLevel: 1 };
const basePreference = { interests: [], preferredActivities: [], travelStyle: null, budget: null };

describe("Admin vocabulary matches Preference Match", () => {
  it("contains exactly the recognizable interest categories", () => {
    expect([...ADMIN_VOCABULARY.tags].sort()).toEqual(canonicalKeys("INTEREST_ALIASES"));
  });
  it("contains exactly the recognizable activity categories", () => {
    expect([...ADMIN_VOCABULARY.activityTypes].sort()).toEqual(canonicalKeys("ACTIVITY_ALIASES"));
  });
  it("contains exactly the recognizable travel style categories", () => {
    expect([...ADMIN_VOCABULARY.travelStyleTags].sort()).toEqual(canonicalKeys("STYLE_ALIASES"));
  });
  it("actually recognizes every Admin tag in a calculation", () => {
    for (const value of ADMIN_VOCABULARY.tags) {
      const result = calculatePreferenceMatch(
        { ...basePreference, interests: [value] },
        [{ id: 1, place: { ...basePlace, tags: [value] } }],
      );
      expect(result.score, value).toBe(100);
      expect(result.breakdown?.places[0]?.dimensions.interests.matched, value).toEqual([value]);
    }
  });
  it("actually recognizes every Admin activity in a calculation", () => {
    for (const value of ADMIN_VOCABULARY.activityTypes) {
      const result = calculatePreferenceMatch(
        { ...basePreference, preferredActivities: [value] },
        [{ id: 1, place: { ...basePlace, activityTypes: [value] } }],
      );
      expect(result.score, value).toBe(100);
      expect(result.breakdown?.places[0]?.dimensions.activities.matched, value).toEqual([value]);
    }
  });
  it("actually recognizes every Admin travel style in a calculation", () => {
    for (const value of ADMIN_VOCABULARY.travelStyleTags) {
      const result = calculatePreferenceMatch(
        { ...basePreference, travelStyle: value },
        [{ id: 1, place: { ...basePlace, travelStyleTags: [value] } }],
      );
      expect(result.score, value).toBe(100);
      expect(result.breakdown?.places[0]?.dimensions.travelStyle.matched, value).toEqual([value]);
    }
  });
});
