import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { prisma } from "../src/lib/prisma.js";

type Candidate = {
  name: string;
  destination: string;
  category: string;
  osm: { type: string; id: number; latitude: number; longitude: number; addrCity: string | null };
  officialSource: string;
  cityEvidence: string;
  status: string;
  seedReady: boolean;
  importedPlaceId?: number;
  seed?: {
    description: string;
    address: string;
    rating: number | null;
    priceLevel: number;
    imageUrl: string | null;
    tags: string[];
    travelStyleTags: string[];
    activityTypes: string[];
  };
  priceRationale?: string;
};

const manifestPath = resolve(process.argv[2] ?? "../docs/place-expansion-2026-09-30/manifest.json");
const normalized = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = radians(b.latitude - a.latitude);
  const lonDelta = radians(b.longitude - a.longitude);
  const value = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lonDelta / 2) ** 2;
  return 12_742_017.6 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    target?: { cities?: string[] };
    newDestinations?: Array<{ name: string; city: string; state: string; description: string; imageUrl: string; latitude: null; longitude: null }>;
    places?: Candidate[];
    heldForReview?: unknown[];
  };
  if (!Array.isArray(manifest.places) || !Array.isArray(manifest.target?.cities)) {
    throw new Error("Manifest places and target.cities must be arrays.");
  }
  const cities = new Set(manifest.target.cities);
  const existing = await prisma.place.findMany({
    select: { id: true, name: true, latitude: true, longitude: true, deletedAt: true, destination: { select: { name: true } } },
  });
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenOsm = new Set<string>();
  const seenName = new Set<string>();
  const seenCandidates: Candidate[] = [];
  for (const destination of manifest.newDestinations ?? []) {
    if (!cities.has(destination.name) || !destination.city?.trim() || !destination.state?.trim()
      || !destination.description?.trim() || destination.imageUrl !== "/destination-placeholder.svg"
      || destination.latitude !== null || destination.longitude !== null) {
      errors.push(`${destination.name}: invalid new destination metadata`);
    }
  }

  for (const candidate of manifest.places) {
    const label = `${candidate.destination}/${candidate.name}`;
    const point = candidate.osm;
    if (!candidate.name?.trim() || !cities.has(candidate.destination)) errors.push(`${label}: missing name or unsupported destination`);
    if (!point || !["node", "way", "relation"].includes(point.type) || !Number.isSafeInteger(point.id) || point.id < 1
      || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)
      || point.latitude < 0 || point.latitude > 8 || point.longitude < 99 || point.longitude > 120) {
      errors.push(`${label}: invalid OSM identity or Malaysian coordinates`);
      continue;
    }
    if (!candidate.officialSource?.startsWith("https://") || !candidate.cityEvidence || candidate.cityEvidence.length < 30) {
      errors.push(`${label}: official source or city evidence missing`);
    }
    if (candidate.status !== "source_verified" || typeof candidate.seedReady !== "boolean") {
      errors.push(`${label}: invalid review status`);
    }
    if (candidate.seedReady) {
      const seed = candidate.seed;
      const validTags = (tags: unknown) => Array.isArray(tags) && tags.length > 0
        && tags.every((tag) => typeof tag === "string" && tag.trim().length > 0);
      if (!candidate.category?.trim() || !seed || !seed.description?.trim() || seed.description.trim().length < 20
        || !seed.address?.trim() || seed.rating !== null
        || !Number.isInteger(seed.priceLevel) || seed.priceLevel < 1 || seed.priceLevel > 4
        || (seed.imageUrl !== null && !seed.imageUrl?.startsWith("https://"))
        || !validTags(seed.tags) || !validTags(seed.travelStyleTags) || !validTags(seed.activityTypes)
        || !candidate.priceRationale || candidate.priceRationale.trim().length < 20) {
        errors.push(`${label}: seedReady requires complete curated seed fields and price rationale`);
      }
    }
    const osmKey = `${point.type}/${point.id}`;
    const nameKey = `${candidate.destination}/${normalized(candidate.name)}`;
    if (seenOsm.has(osmKey)) errors.push(`${label}: repeated OSM object ${osmKey}`);
    if (seenName.has(nameKey)) errors.push(`${label}: repeated destination/name`);
    seenOsm.add(osmKey);
    seenName.add(nameKey);
    for (const previous of seenCandidates) {
      if (distanceMeters(point, previous.osm) <= 75) {
        warnings.push(`${label}: within 75 m of manifest candidate ${previous.destination}/${previous.name}; inspect identity before seed`);
      }
    }
    seenCandidates.push(candidate);

    for (const place of existing) {
      const coordinates = place.latitude === null || place.longitude === null ? null : {
        latitude: Number(place.latitude), longitude: Number(place.longitude),
      };
      if (place.destination.name === candidate.destination && normalized(place.name) === normalized(candidate.name)) {
        if (place.id !== candidate.importedPlaceId || place.deletedAt || !coordinates
          || distanceMeters(point, coordinates) > 1) {
          errors.push(`${label}: already exists as Place ${place.id}${place.deletedAt ? " (archived)" : ""}`);
        }
      } else if (coordinates && distanceMeters(point, coordinates) <= 75) {
        warnings.push(`${label}: within 75 m of Place ${place.id} (${place.name}); inspect identity before seed`);
      }
    }
    if (candidate.importedPlaceId && !existing.some((place) => place.id === candidate.importedPlaceId
      && place.destination.name === candidate.destination && normalized(place.name) === normalized(candidate.name)
      && place.deletedAt === null)) {
      errors.push(`${label}: importedPlaceId ${candidate.importedPlaceId} does not match an active Place`);
    }
  }

  console.log(JSON.stringify({
    manifestPath,
    sourceVerified: manifest.places.length,
    seedReady: manifest.places.filter((candidate) => candidate.seedReady).length,
    imported: manifest.places.filter((candidate) => candidate.importedPlaceId).length,
    heldForReview: manifest.heldForReview?.length ?? 0,
    existingPlacesChecked: existing.length,
    archivedPlaceIds: existing.filter((place) => place.deletedAt !== null).map((place) => place.id),
    errors,
    warnings,
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
