import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve("../docs/place-expansion-2026-10-15");
const ranked = JSON.parse(await readFile(resolve(root, "ranked-candidates.json"), "utf8"));
const reviewed = JSON.parse(await readFile(resolve(root, "reviewed-prices.json"), "utf8"));
const evidenceDirectory = resolve(root, "evidence");
const seen = new Set();
const places = [];
const maxByCity = { "Kuala Lumpur": 4, Penang: 3, Melaka: 3 };
const counts = {};

for (const review of reviewed) {
  const key = `${review.destination}:${review.category}:${review.osmId}`;
  if (seen.has(key)) throw new Error(`Repeated review: ${key}`);
  seen.add(key);
  const candidate = ranked.selected.find((entry) => entry.osmId === review.osmId
    && entry.destination === review.destination && entry.category === review.category);
  if (!candidate || candidate.name !== (review.osmName ?? review.name)) throw new Error(`OSM identity mismatch: ${key}`);
  if (!Number.isFinite(candidate.distanceMeters) || candidate.distanceMeters > 1000) {
    throw new Error(`Outside cutoff: ${key}`);
  }
  if (!Number.isFinite(review.priceMYR) || review.priceMYR <= 0) throw new Error(`Bad price: ${key}`);
  const band = review.category === "Accommodation"
    ? [150, 350, 700] : [20, 50, 120];
  const level = 1 + band.filter((cutoff) => review.priceMYR >= cutoff).length;
  if (level !== review.priceLevel) throw new Error(`Price level mismatch: ${key}`);
  if (!review.identityUrl?.startsWith("https://") || !review.priceUrl?.startsWith("https://")) {
    throw new Error(`Unlinked source: ${key}`);
  }
  const group = `${review.destination}:${review.category}`;
  counts[group] = (counts[group] ?? 0) + 1;
  if (counts[group] > maxByCity[review.destination]) throw new Error(`Quota exceeded: ${group}`);
  const evidenceName = `${candidate.osmType}-${candidate.osmId}.json`;
  const evidence = {
    checkedAt: "2026-10-16",
    status: "provisionally shortlisted; desk-checked from web sources, not site visits",
    osm: { type: candidate.osmType, id: candidate.osmId,
      latitude: candidate.latitude, longitude: candidate.longitude },
    name: review.name,
    osmName: candidate.name,
    category: candidate.category,
    destination: candidate.destination,
    nearestAnchor: candidate.nearestAnchor,
    distanceMeters: candidate.distanceMeters,
    identityUrl: review.identityUrl,
    priceUrl: review.priceUrl,
    address: review.address,
    price: { amountMYR: review.priceMYR, unit: review.priceUnit,
      basis: review.priceBasis, level },
    locationNote: "OSM coordinates; no independent geocoding was performed.",
    openStatusNote: "Venue-operated page or linked booking engine was reachable on the check date; no site visit was performed.",
  };
  const accommodation = review.category === "Accommodation";
  const seed = {
    description: accommodation
      ? `Hotel accommodation in ${review.destination} near ${candidate.nearestAnchor}.`
      : `Restaurant in ${review.destination} near ${candidate.nearestAnchor}.`,
    address: review.address,
    rating: null,
    priceLevel: level,
    imageUrl: null,
    tags: accommodation ? ["hotel", "accommodation"] : ["restaurant", "food"],
    travelStyleTags: accommodation ? ["urban", "relaxed"] : ["food", "urban"],
    activityTypes: accommodation ? ["staying"] : ["dining"],
  };
  places.push({
    name: review.name,
    destination: candidate.destination,
    category: candidate.category,
    osm: { type: candidate.osmType, id: candidate.osmId,
      latitude: candidate.latitude, longitude: candidate.longitude,
      addrCity: candidate.addressCity },
    officialSource: review.identityUrl,
    priceSource: review.priceUrl,
    evidencePath: `evidence/${evidenceName}`,
    status: "source_verified",
    seedReady: true,
    seed,
  });
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(resolve(evidenceDirectory, evidenceName), `${JSON.stringify(evidence, null, 2)}\n`);
}

places.sort((a, b) => a.destination.localeCompare(b.destination)
  || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
const manifest = {
  schemaVersion: 2,
  checkedAt: "2026-10-16",
  sourceSnapshot: ranked.osmPbfSha256,
  newDestinations: [],
  places,
  requested: { Accommodation: 10, Restaurant: 10 },
  reviewedCounts: counts,
  shortfall: { Accommodation: 10 - places.filter((p) => p.category === "Accommodation").length,
    Restaurant: 10 - places.filter((p) => p.category === "Restaurant").length },
};
await writeFile(resolve(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ count: places.length, groups: counts, shortfall: manifest.shortfall }));
