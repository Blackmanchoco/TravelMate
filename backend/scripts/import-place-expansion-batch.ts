import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Prisma } from "@prisma/client";

import { prisma } from "../src/lib/prisma.js";
import { assertCommercialManifest, assertCommercialScratchUrl } from "./commercial-import-guard.js";

type Seed = {
  description: string;
  address: string;
  rating: null;
  priceLevel: number;
  imageUrl: string | null;
  tags: string[];
  travelStyleTags: string[];
  activityTypes: string[];
};
type Candidate = {
  name: string;
  destination: string;
  category: string;
  osm: { type: string; id: number; latitude: number; longitude: number };
  status: string;
  seedReady: boolean;
  importedPlaceId?: number;
  officialSource?: string;
  priceSource?: string;
  evidencePath?: string;
  seed: Seed;
};
type NewDestination = {
  name: string;
  city: string;
  state: string;
  description: string;
  imageUrl: string;
  latitude: null;
  longitude: null;
};

const apply = process.argv.includes("--apply");
const commercialBatch = process.argv.includes("--commercial-batch");
const manifestPath = commercialBatch
  ? resolve("../docs/place-expansion-2026-10-15/manifest.json")
  : resolve("../docs/place-expansion-2026-09-30/manifest.json");
const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
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
  if (commercialBatch) assertCommercialScratchUrl(process.env.DATABASE_URL);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    places: Candidate[];
    newDestinations: NewDestination[];
  };
  if (!Array.isArray(manifest.places) || !Array.isArray(manifest.newDestinations)) {
    throw new Error("Manifest lacks places or newDestinations.");
  }
  const candidates = manifest.places.filter((place) => place.seedReady && place.status === "source_verified");
  if (commercialBatch) {
    assertCommercialManifest(manifest as Parameters<typeof assertCommercialManifest>[0]);
    for (const candidate of candidates) {
      const evidencePath = resolve("../docs/place-expansion-2026-10-15", candidate.evidencePath!);
      const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as {
        osm: { type: string; id: number; latitude: number; longitude: number };
        name: string; destination: string; category: string; identityUrl: string;
        priceUrl: string; price: { level: number; amountMYR: number };
        checkedAt: string; status: string;
      };
      if (evidence.osm.type !== candidate.osm.type || evidence.osm.id !== candidate.osm.id
        || evidence.osm.latitude !== candidate.osm.latitude
        || evidence.osm.longitude !== candidate.osm.longitude
        || evidence.name !== candidate.name || evidence.destination !== candidate.destination
        || evidence.category !== candidate.category || evidence.identityUrl !== candidate.officialSource
        || evidence.priceUrl !== candidate.priceSource || evidence.price.level !== candidate.seed.priceLevel
        || !Number.isFinite(evidence.price.amountMYR) || evidence.price.amountMYR <= 0
        || evidence.checkedAt !== "2026-10-16"
        || evidence.status !== "provisionally shortlisted; desk-checked from web sources, not site visits") {
        throw new Error(`Commercial evidence mismatch: ${candidate.name}`);
      }
    }
  } else if (candidates.length !== 6 || candidates.length !== manifest.places.length) {
    throw new Error("This first-batch importer requires exactly six source-verified, seed-ready Places.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const destinations = await tx.destination.findMany();
    const existing = await tx.place.findMany({ include: { destination: { select: { name: true } } } });
    const newByName = new Map(manifest.newDestinations.map((item) => [item.name, item]));
    const destinationByName = new Map(destinations.map((item) => [item.name, item]));
    const output: Array<{ destination: string; name: string; id: number | null; action: string }> = [];

    // Check the entire batch before the first write, including archived rows.
    for (const candidate of candidates) {
      const definition = newByName.get(candidate.destination);
      if (!destinationByName.has(candidate.destination) && (!definition || !definition.city || !definition.state
        || !definition.description || definition.imageUrl !== "/destination-placeholder.svg")) {
        throw new Error(`${candidate.destination}: missing verified Destination metadata`);
      }
      const sameName = existing.find((place) => place.destination.name === candidate.destination
        && normalize(place.name) === normalize(candidate.name));
      if (sameName) {
        const seed = candidate.seed;
        const matching = !sameName.deletedAt && sameName.name === candidate.name
          && sameName.category === candidate.category && sameName.description === seed.description
          && sameName.address === seed.address && sameName.rating === null
          && sameName.priceLevel === seed.priceLevel && sameName.imageUrl === seed.imageUrl
          && JSON.stringify(sameName.tags) === JSON.stringify(seed.tags)
          && JSON.stringify(sameName.travelStyleTags) === JSON.stringify(seed.travelStyleTags)
          && JSON.stringify(sameName.activityTypes) === JSON.stringify(seed.activityTypes)
          && sameName.latitude !== null && sameName.longitude !== null
          && distanceMeters(candidate.osm, {
            latitude: Number(sameName.latitude), longitude: Number(sameName.longitude),
          }) <= 1;
        if (!matching || (candidate.importedPlaceId && candidate.importedPlaceId !== sameName.id)) {
          throw new Error(`${candidate.destination}/${candidate.name}: existing Place ${sameName.id} differs from manifest`);
        }
      } else if (candidate.importedPlaceId) {
        throw new Error(`${candidate.destination}/${candidate.name}: imported Place ${candidate.importedPlaceId} missing`);
      }
      for (const place of existing) {
        if (place.id === sameName?.id || place.latitude === null || place.longitude === null) continue;
        if (distanceMeters(candidate.osm, {
          latitude: Number(place.latitude), longitude: Number(place.longitude),
        }) <= 75) {
          throw new Error(`${candidate.destination}/${candidate.name}: within 75 m of Place ${place.id} (${place.name})`);
        }
      }
      output.push({ destination: candidate.destination, name: candidate.name, id: sameName?.id ?? null,
        action: sameName ? "already_present" : apply ? "create" : "would_create" });
    }

    if (!apply) return output;
    for (const definition of manifest.newDestinations) {
      if (destinationByName.has(definition.name)) continue;
      const created = await tx.destination.create({ data: definition });
      destinationByName.set(created.name, created);
    }
    for (const [index, candidate] of candidates.entries()) {
      if (output[index]?.id) continue;
      const destination = destinationByName.get(candidate.destination);
      if (!destination) throw new Error(`${candidate.destination}: Destination missing after create`);
      const created = await tx.place.create({
        data: {
          destinationId: destination.id,
          name: candidate.name,
          category: candidate.category,
          description: candidate.seed.description,
          address: candidate.seed.address,
          latitude: candidate.osm.latitude,
          longitude: candidate.osm.longitude,
          rating: null,
          priceLevel: candidate.seed.priceLevel,
          imageUrl: candidate.seed.imageUrl,
          tags: candidate.seed.tags,
          travelStyleTags: candidate.seed.travelStyleTags,
          activityTypes: candidate.seed.activityTypes,
        },
      });
      output[index] = { ...output[index]!, id: created.id, action: "created" };
    }
    return output;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry_run", places: result }, null, 2));
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
