import { describe, expect, it } from "vitest";

import { asciiJson, selectCandidates } from "../ai/data/select_commercial_candidates.mjs";

const anchors = [
  { id: 1, name: "Headline", destination: "Kuala Lumpur", category: "Attraction", rating: 4.5, latitude: 3.15, longitude: 101.7, deletedAt: null },
];
const record = (id: number, name: string, latitude: number, tags: Record<string, string>) => ({
  osmType: "node", osmId: id, name, latitude, longitude: 101.7, tags, inactive: false,
});

describe("commercial candidate selection", () => {
  it("serializes source names as ASCII-safe JSON without losing text", () => {
    const value = { name: "\u4e2d\u6587 Restaurant" };
    const serialized = asciiJson(value);
    expect([...serialized].every((character) => character.codePointAt(0)! < 128)).toBe(true);
    expect(JSON.parse(serialized)).toEqual(value);
  });
  it("allows only requested OSM tags and cuts off at one kilometre", () => {
    const records = [
      record(1, "Near Hotel", 3.151, { tourism: "hotel" }),
      record(2, "Near Restaurant", 3.151, { amenity: "restaurant" }),
      record(3, "Near Cafe", 3.151, { amenity: "cafe" }),
      record(4, "Far Hotel", 3.16, { tourism: "hotel" }),
    ];
    const selected = selectCandidates(records, anchors);
    expect(selected.map((item: { name: string }) => item.name)).toEqual(["Near Hotel", "Near Restaurant"]);
  });
  it("excludes an inactive business even when its category and location match", () => {
    const inactive = { ...record(1, "Closed Restaurant", 3.151, { amenity: "restaurant" }), inactive: true };
    const active = record(2, "Open Restaurant", 3.152, { amenity: "restaurant" });
    expect(selectCandidates([inactive, active], anchors).map((item: { name: string }) => item.name))
      .toEqual(["Open Restaurant"]);
  });

  it("sorts by distance and numeric OSM ID, then deduplicates nearby names", () => {
    const records = [
      record(20, "Same Hotel", 3.151, { tourism: "hotel" }),
      record(3, "Same Hotel", 3.151, { tourism: "hotel" }),
      record(10, "Other Hotel", 3.152, { tourism: "hotel" }),
    ];
    expect(selectCandidates(records, anchors).map((item: { osmId: number }) => item.osmId)).toEqual([3, 10]);
  });

  it("rejects wrong address cities and conflicts with existing or archived Places", () => {
    const records = [
      record(1, "Wrong City", 3.151, { tourism: "hotel", "addr:city": "Petaling Jaya" }),
      record(2, "Existing Name", 3.152, { tourism: "hotel" }),
      record(3, "Close To Archived", 3.15, { tourism: "hotel" }),
      record(4, "Valid Hotel", 3.153, { tourism: "hotel" }),
    ];
    const places = [
      ...anchors,
      { id: 2, name: "Existing Name", destination: "Kuala Lumpur", category: "Accommodation", rating: null, latitude: 3.18, longitude: 101.7, deletedAt: null },
      { id: 3, name: "Old Hotel", destination: "Kuala Lumpur", category: "Accommodation", rating: null, latitude: 3.1501, longitude: 101.7, deletedAt: "2026-01-01" },
    ];
    expect(selectCandidates(records, places).map((item: { name: string }) => item.name)).toEqual(["Valid Hotel"]);
  });
});
