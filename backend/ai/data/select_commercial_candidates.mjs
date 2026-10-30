import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const destinations = ["Kuala Lumpur", "Penang", "Melaka"];
const anchorCategories = new Set(["Attraction", "Nature", "Culture", "Historical"]);
const accommodationTags = new Set(["hotel", "guest_house", "hostel", "apartment", "motel", "homestay"]);
const restaurantTags = new Set(["restaurant", "food_court"]);
const cityAliases = {
  "Kuala Lumpur": new Set(["kuala lumpur"]),
  Penang: new Set(["penang", "george town", "georgetown", "batu ferringhi", "air itam", "ayer itam"]),
  Melaka: new Set(["melaka", "malacca", "bandar melaka", "melaka city"]),
};

const normalize = (value) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function distanceMeters(a, b) {
  const rad = (degrees) => degrees * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const haversine = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 12_742_017.6 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function categoryFor(tags = {}) {
  if (accommodationTags.has(tags.tourism)) return "Accommodation";
  if (restaurantTags.has(tags.amenity)) return "Restaurant";
  return null;
}

function numericId(record) {
  const id = Number(record.osmId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function rankCandidates(records, places) {
  const anchors = places.filter((place) => place.deletedAt == null && anchorCategories.has(place.category)
    && Number(place.rating) >= 4.4 && destinations.includes(place.destination)
    && Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude)));
  const eligible = [];
  const rejected = [];
  for (const record of records) {
    const category = categoryFor(record.tags);
    if (!category) continue;
    const osmId = numericId(record);
    if (record.inactive || !record.name?.trim() || osmId == null
      || !Number.isFinite(Number(record.latitude)) || !Number.isFinite(Number(record.longitude))) {
      rejected.push({ osmType: record.osmType, osmId: record.osmId, name: record.name, reason: "invalid_or_inactive" });
      continue;
    }
    for (const destination of destinations) {
      const nearest = anchors.filter((anchor) => anchor.destination === destination)
        .map((anchor) => ({ anchor, distanceMeters: distanceMeters(record, anchor) }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters || a.anchor.id - b.anchor.id)[0];
      if (!nearest || nearest.distanceMeters > 1_000) continue;
      const city = normalize(record.tags?.["addr:city"]);
      if (city && !cityAliases[destination].has(city)) {
        rejected.push({ osmType: record.osmType, osmId, name: record.name, destination, reason: "address_city_mismatch" });
        continue;
      }
      eligible.push({
        osmType: record.osmType, osmId, name: record.name.trim(), category, destination,
        latitude: Number(record.latitude), longitude: Number(record.longitude),
        addressCity: record.tags?.["addr:city"] ?? null,
        website: record.tags?.website ?? record.tags?.["contact:website"] ?? null,
        tags: record.tags, nearestAnchor: nearest.anchor.name,
        nearestAnchorId: nearest.anchor.id, distanceMeters: nearest.distanceMeters,
      });
    }
  }
  eligible.sort((a, b) => a.distanceMeters - b.distanceMeters || a.osmId - b.osmId
    || String(a.osmType).localeCompare(String(b.osmType)) || a.destination.localeCompare(b.destination));
  const selected = [];
  for (const candidate of eligible) {
    const key = normalize(candidate.name);
    const duplicate = selected.find((other) => other.destination === candidate.destination
      && other.category === candidate.category && normalize(other.name) === key
      && distanceMeters(other, candidate) <= 300);
    if (duplicate) {
      rejected.push({ osmType: candidate.osmType, osmId: candidate.osmId, name: candidate.name,
        destination: candidate.destination, reason: "osm_same_name_within_300m", keptOsmId: duplicate.osmId });
      continue;
    }
    const conflict = places.find((place) => normalize(place.name) === key && place.destination === candidate.destination
      || Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude))
      && place.latitude !== null && place.longitude !== null && distanceMeters(place, candidate) <= 75);
    if (conflict) {
      rejected.push({ osmType: candidate.osmType, osmId: candidate.osmId, name: candidate.name,
        destination: candidate.destination, reason: "existing_place_conflict", existingPlaceId: conflict.id });
      continue;
    }
    selected.push(candidate);
  }
  return { selected, rejected, anchors: anchors.map(({ id, name, destination, category, rating, latitude, longitude }) =>
    ({ id, name, destination, category, rating, latitude, longitude })) };
}

export const selectCandidates = (records, places) => rankCandidates(records, places).selected;
export const asciiJson = (value) => JSON.stringify(value, null, 2)
  .replace(/[\u007f-\uffff]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [cachePath, placesPath, outputPath] = process.argv.slice(2);
  if (!cachePath || !placesPath || !outputPath) {
    throw new Error("Usage: node select_commercial_candidates.mjs OSM_CACHE PLACES_JSON OUTPUT_JSON");
  }
  const cache = JSON.parse(await readFile(cachePath, "utf8"));
  const places = JSON.parse(await readFile(placesPath, "utf8"));
  if (!Array.isArray(cache.records) || !Array.isArray(places)) throw new Error("Invalid input JSON");
  const output = { osmPbfSha256: cache.pbfSha256, ...rankCandidates(cache.records, places) };
  await writeFile(outputPath, `${asciiJson(output)}\n`, "utf8");
  console.log(JSON.stringify({ anchors: output.anchors.length, selected: output.selected.length,
    rejected: output.rejected.length, outputPath: resolve(outputPath) }));
}
