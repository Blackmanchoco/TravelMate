type Candidate = {
  name: string;
  destination: string;
  category: string;
  osm: { type: string; id: number; latitude: number; longitude: number };
  officialSource: string;
  priceSource: string;
  evidencePath: string;
  status: string;
  seedReady: boolean;
  seed: { description: string; address: string; rating: null; priceLevel: number;
    imageUrl: null; tags: string[]; travelStyleTags: string[]; activityTypes: string[] };
};

function distanceMeters(a: Candidate["osm"], b: Candidate["osm"]) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitude = toRadians(b.latitude - a.latitude);
  const longitude = toRadians(b.longitude - a.longitude);
  const value = Math.sin(latitude / 2) ** 2 + Math.cos(toRadians(a.latitude))
    * Math.cos(toRadians(b.latitude)) * Math.sin(longitude / 2) ** 2;
  return 12_742_017.6 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function assertCommercialScratchUrl(connectionString: string | undefined) {
  if (!connectionString) throw new Error("Commercial import requires DATABASE_URL.");
  const parsed = new URL(connectionString);
  if (!(["postgresql:", "postgres:"].includes(parsed.protocol))
    || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
    || !/^travelmate_scratch_\d{8}[a-z]$/.test(decodeURIComponent(parsed.pathname.slice(1)))) {
    throw new Error("Commercial import requires an exact local travelmate_scratch_YYYYMMDDx database.");
  }
}

export function assertCommercialManifest(manifest: { newDestinations: unknown[]; places: Candidate[] }) {
  if (!Array.isArray(manifest.newDestinations) || manifest.newDestinations.length !== 0
    || !Array.isArray(manifest.places) || manifest.places.length < 1 || manifest.places.length > 20) {
    throw new Error("Commercial manifest must have 1-20 Places and no new Destinations.");
  }
  const quotas: Record<string, number> = {};
  for (const place of manifest.places) {
    if (!["Kuala Lumpur", "Penang", "Melaka"].includes(place.destination)
      || !["Accommodation", "Restaurant"].includes(place.category)
      || place.status !== "source_verified" || place.seedReady !== true
      || !place.officialSource?.startsWith("https://")
      || !place.priceSource?.startsWith("https://")
      || !/^evidence\/(node|way|relation)-\d+\.json$/.test(place.evidencePath)
      || !place.name || !place.seed?.description || !place.seed.address
      || place.seed.rating !== null || place.seed.imageUrl !== null
      || !Number.isInteger(place.seed.priceLevel) || place.seed.priceLevel < 1 || place.seed.priceLevel > 4
      || !Number.isFinite(place.osm?.latitude) || !Number.isFinite(place.osm.longitude)
      || !Number.isSafeInteger(place.osm.id)
      || !Array.isArray(place.seed.tags) || !Array.isArray(place.seed.travelStyleTags)
      || !Array.isArray(place.seed.activityTypes)) {
      throw new Error(`Invalid commercial Place: ${place.name ?? "unnamed"}`);
    }
    const key = `${place.destination}:${place.category}`;
    quotas[key] = (quotas[key] ?? 0) + 1;
    if (quotas[key] > (place.destination === "Kuala Lumpur" ? 4 : 3)) {
      throw new Error(`Commercial quota exceeded: ${key}`);
    }
  }
  assertNoBatchConflicts(manifest.places);
}

export function assertNoBatchConflicts(candidates: Candidate[]) {
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const first = candidates[i]!;
      const second = candidates[j]!;
      if (first.destination !== second.destination) continue;
      if (first.name.normalize("NFKC").toLowerCase() === second.name.normalize("NFKC").toLowerCase()
        || distanceMeters(first.osm, second.osm) <= 75) {
        throw new Error(`Conflicting commercial candidates: ${first.name} / ${second.name}`);
      }
    }
  }
}
