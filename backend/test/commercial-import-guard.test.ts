import { describe, expect, it } from "vitest";

import { assertCommercialManifest, assertCommercialScratchUrl,
  assertNoBatchConflicts } from "../scripts/commercial-import-guard.js";

const row = (name: string, latitude: number, longitude = 101.7) => ({
  name, destination: "Kuala Lumpur", category: "Restaurant",
  osm: { type: "node", id: 1, latitude, longitude },
  officialSource: "https://venue.example/", priceSource: "https://venue.example/menu",
  evidencePath: "evidence/node-1.json", status: "source_verified", seedReady: true,
  seed: { description: "Restaurant in Kuala Lumpur.", address: "1 Street, Kuala Lumpur",
    rating: null, priceLevel: 2, imageUrl: null, tags: ["restaurant"],
    travelStyleTags: ["food"], activityTypes: ["dining"] },
});

describe("commercial import guard", () => {
  it("requires an exact local scratch database URL", () => {
    expect(() => assertCommercialScratchUrl("postgresql://u:p@localhost:5432/travelmate_scratch_20261016d")).not.toThrow();
    for (const url of ["postgresql://u:p@localhost:5432/travelmate_demo_20261006",
      "postgresql://u:p@remote.example:5432/travelmate_scratch_20261016d",
      "postgresql://u:p@localhost:5432/travelmate_scratch_20261016d_extra"]) {
      expect(() => assertCommercialScratchUrl(url)).toThrow();
    }
  });
  it("rejects absent evidence, rating, images, and destination creation", () => {
    const good = { newDestinations: [], places: [row("Venue", 3.15)] };
    expect(() => assertCommercialManifest(good)).not.toThrow();
    expect(() => assertCommercialManifest({ ...good, newDestinations: [{ name: "Other" }] })).toThrow();
    expect(() => assertCommercialManifest({ ...good, places: [{ ...good.places[0], priceSource: "" }] })).toThrow();
    expect(() => assertCommercialManifest({ ...good, places: [{ ...good.places[0], seed: { ...good.places[0].seed, rating: 5 } }] })).toThrow();
  });
  it("rejects near or duplicate candidates within one batch", () => {
    expect(() => assertNoBatchConflicts([row("A", 3.15), row("B", 3.1501)])).toThrow();
    expect(() => assertNoBatchConflicts([row("A", 3.15), row("A", 3.16)])).toThrow();
    expect(() => assertNoBatchConflicts([row("A", 3.15), row("B", 3.16)])).not.toThrow();
  });
});
