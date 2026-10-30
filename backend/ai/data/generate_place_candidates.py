"""Read-only six-city OSM review pool. Output is never an import manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import time
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

import osmium
import psycopg2
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PBF = ROOT / ".local-data/osm/malaysia-singapore-brunei-latest.osm.pbf"
DEFAULT_MANIFEST = ROOT / "docs/place-expansion-2026-09-30/manifest.json"
DEFAULT_OUTPUT = ROOT / ".local-data/osm/place-review-pool.json"
DEFAULT_CACHE = ROOT / ".local-data/osm/place-extracted-cache.json"
RADIUS_KM = 15.0
NEAR_METRES = 75.0
OSM_NAME_DEDUP_METRES = 300.0

# Soft final-city targets scaled from the earlier 150-Place allocation. The
# review pool is deliberately larger; neither these targets nor a full pool
# authorizes import without official-source and city review.
CITY_TARGETS = {
    "Kuala Lumpur": (50, 3.1390, 101.6869, {"kuala lumpur", "wp kuala lumpur"}),
    "Penang": (50, 5.4141, 100.3288, {"penang", "pulau pinang", "george town", "georgetown"}),
    "Melaka": (42, 2.1896, 102.2501, {"melaka", "malacca", "melaka city"}),
    "Kota Kinabalu": (42, 5.9804, 116.0735, {"kota kinabalu", "kk"}),
    "Kuching": (42, 1.5533, 110.3592, {"kuching"}),
    "Klang": (24, 3.0449, 101.4456, {"klang"}),
}
CATEGORY_WEIGHTS = {
    "Attraction": 0.25,
    "Nature": 0.15,
    "Culture": 0.10,
    "Restaurant": 0.25,
    "Shopping": 0.15,
    "Accommodation": 0.10,
}
ATTRACTION_TOURISM = {"attraction", "viewpoint", "theme_park", "zoo", "aquarium"}
CULTURE_TOURISM = {"museum", "gallery"}
FOOD_AMENITY = {"restaurant", "cafe", "fast_food", "food_court"}
STAY_TOURISM = {"hotel", "hostel", "guest_house", "motel", "apartment", "chalet", "camp_site"}
SHOP_TYPES = {"gift", "souvenir", "mall", "department_store", "craft"}
NATURE_LEISURE = {"park", "nature_reserve", "garden"}
NATURE_NATURAL = {"peak", "waterfall", "beach", "cave_entrance"}
CORROBORATION = {"addr:street", "addr:housenumber", "addr:full", "website", "contact:website",
                 "wikidata", "wikipedia", "opening_hours", "operator", "brand"}
KNOWN_CHAINS = ("mcdonald", "starbucks", "kfc", "kentucky fried chicken", "subway",
                "pizza hut", "domino", "tealive", "coffee bean", "marrybrown")
OUTPUT_TAGS = ("tourism", "historic", "amenity", "shop", "leisure", "natural", "addr:city",
               "addr:street", "addr:housenumber", "addr:full", "website", "contact:website",
               "wikidata", "wikipedia", "operator", "brand", "opening_hours")


def norm(value: str | None) -> str:
    if not value:
        return ""
    value = unicodedata.normalize("NFKD", value).casefold()
    value = "".join(char for char in value if not unicodedata.combining(char))
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value).split())


def distance_km(a: float, b: float, c: float, d: float) -> float:
    radians = math.radians
    delta_lat, delta_lon = radians(c - a), radians(d - b)
    x = math.sin(delta_lat / 2) ** 2 + math.cos(radians(a)) * math.cos(radians(c)) * math.sin(delta_lon / 2) ** 2
    return 12_742.0176 * math.atan2(math.sqrt(x), math.sqrt(1 - x))


def classify(tags: dict[str, str]) -> list[str]:
    categories = []
    if tags.get("tourism") in CULTURE_TOURISM or "historic" in tags:
        categories.append("Culture")
    if tags.get("leisure") in NATURE_LEISURE or tags.get("natural") in NATURE_NATURAL:
        categories.append("Nature")
    if tags.get("tourism") in ATTRACTION_TOURISM:
        categories.append("Attraction")
    if tags.get("amenity") in FOOD_AMENITY:
        categories.append("Restaurant")
    if tags.get("shop") in SHOP_TYPES:
        categories.append("Shopping")
    if tags.get("tourism") in STAY_TOURISM:
        categories.append("Accommodation")
    return categories


def name_of(tags: dict[str, str]) -> str:
    return next((tags[key].strip() for key in ("name:en", "name", "official_name", "name:ms")
                 if tags.get(key, "").strip()), "")


def inactive(tags: dict[str, str]) -> bool:
    if tags.get("access", "").casefold() in {"private", "no"}:
        return True
    if any(tags.get(key, "").casefold() in {"yes", "true", "1"}
           for key in ("disused", "abandoned", "demolished")):
        return True
    return any(key.startswith(("disused:", "abandoned:", "demolished:")) for key in tags)


def brand_of(item: dict) -> str:
    if item["category"] not in {"Restaurant", "Shopping", "Accommodation"}:
        return ""
    tags = item["tags"]
    brand = norm(tags.get("brand") or "")
    if brand:
        return brand
    name = norm(item["name"])
    return next((chain for chain in KNOWN_CHAINS if name.startswith(chain)), "")


def score(item: dict) -> int:
    tags = item["tags"]
    return (2 * bool(tags.get("addr:city")) + bool(tags.get("addr:street") or tags.get("addr:full"))
            + 2 * bool(tags.get("website") or tags.get("contact:website"))
            + bool(tags.get("wikidata") or tags.get("wikipedia"))
            + bool(tags.get("opening_hours")))


class Extractor(osmium.SimpleHandler):
    def __init__(self) -> None:
        super().__init__()
        self.records: dict[tuple[str, int], dict] = {}
        self.relations: dict[int, dict[str, str]] = {}

    def store(self, kind: str, identifier: int, tags: dict[str, str], lat: float, lon: float) -> None:
        categories = classify(tags)
        if not categories or not (-0.5 <= lat <= 7.5 and 99 <= lon <= 120):
            return
        nearby = [(city, distance_km(lat, lon, config[1], config[2]))
                  for city, config in CITY_TARGETS.items()]
        nearby = [(city, dist) for city, dist in nearby if dist <= RADIUS_KM]
        if not nearby:
            return
        self.records[kind, int(identifier)] = {
            "osmType": kind, "osmId": int(identifier), "name": name_of(tags),
            "categories": categories, "latitude": round(lat, 7), "longitude": round(lon, 7),
            "nearby": sorted(nearby, key=lambda pair: (pair[1], pair[0])),
            "tags": {key: tags[key] for key in OUTPUT_TAGS if tags.get(key)},
            "inactive": inactive(tags),
        }

    def node(self, node) -> None:
        tags = dict(node.tags)
        if not classify(tags) or not node.location.valid():
            return
        self.store("node", node.id, tags, node.location.lat, node.location.lon)

    def way(self, way) -> None:
        tags = dict(way.tags)
        if not classify(tags):
            return
        points = [(ref.location.lat, ref.location.lon) for ref in way.nodes if ref.location.valid()]
        if points:
            self.store("way", way.id, tags, sum(x for x, _ in points) / len(points),
                       sum(y for _, y in points) / len(points))

    def relation(self, relation) -> None:
        tags = dict(relation.tags)
        if classify(tags):
            self.relations[int(relation.id)] = tags

    def area(self, area) -> None:
        from_way, identifier = bool(area.from_way()), int(area.orig_id())
        kind = "way" if from_way else "relation"
        tags = dict(area.tags) if from_way else self.relations.get(identifier, {})
        if not classify(tags):
            return
        points = [(ref.location.lat, ref.location.lon) for ring in area.outer_rings()
                  for ref in ring if ref.location.valid()]
        if points:
            self.store(kind, identifier, tags, sum(x for x, _ in points) / len(points),
                       sum(y for _, y in points) / len(points))


def read_existing() -> tuple[list[dict], Counter]:
    load_dotenv(ROOT / "backend/.env")
    parsed = urlsplit(os.environ["DATABASE_URL"])
    connection = psycopg2.connect(host=parsed.hostname, port=parsed.port or 5432,
                                  database=parsed.path.lstrip("/"), user=parsed.username,
                                  password=parsed.password or "")
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT p.id, d.name, p.name, p.latitude, p.longitude, p."deletedAt", p.category '
                           'FROM places p JOIN destinations d ON d.id = p."destinationId"')
            places = [dict(id=row[0], destination=row[1], name=row[2], latitude=float(row[3]) if row[3] is not None else None,
                           longitude=float(row[4]) if row[4] is not None else None, archived=row[5] is not None,
                           category=row[6]) for row in cursor.fetchall()]
    finally:
        connection.close()
    counts = Counter(place["destination"] for place in places
                     if not place["archived"] and place["category"].casefold() != "test")
    return places, counts


def assign_city(item: dict) -> tuple[str | None, str]:
    address_city = norm(item["tags"].get("addr:city"))
    if address_city:
        matches = [city for city, _ in item["nearby"] if address_city in CITY_TARGETS[city][3]]
        if not matches:
            return None, "ADDR_CITY_OUTSIDE_TARGET"
        return matches[0], "addr_city_match"
    return item["nearby"][0][0], "missing_addr_city_manual_review"


def select(records: list[dict], existing: list[dict], counts: Counter, manifest: dict,
           multiplier: float, max_brand: int) -> dict:
    excluded_osm = {(item["osm"]["type"], item["osm"]["id"])
                    for item in manifest["places"] + manifest.get("heldForReview", [])}
    manifest_places = manifest["places"] + manifest.get("heldForReview", [])
    exclusions = Counter()
    preliminary = []
    for item in records:
        if not item["name"] or item["inactive"]:
            exclusions["NO_NAME_OR_INACTIVE"] += 1
            continue
        if (item["osmType"], item["osmId"]) in excluded_osm:
            exclusions["ALREADY_IN_MANIFEST"] += 1
            continue
        city, city_basis = assign_city(item)
        if city is None:
            exclusions[city_basis] += 1
            continue
        if city == "Klang" and ("i city" in norm(item["name"])
                                or "shah alam" in norm(" ".join(item["tags"].values()))):
            exclusions["KNOWN_OUTSIDE_LOCALITY"] += 1
            continue
        name_key = norm(item["name"])
        same = [place for place in existing if place["destination"] == city and norm(place["name"]) == name_key]
        if same:
            exclusions["EXISTING_NAME_INCLUDING_ARCHIVED"] += 1
            continue
        near = [place["id"] for place in existing if place["latitude"] is not None and
                distance_km(item["latitude"], item["longitude"], place["latitude"], place["longitude"]) * 1000 <= NEAR_METRES]
        near_manifest = [place["name"] for place in manifest_places
                         if distance_km(item["latitude"], item["longitude"],
                                        place["osm"]["latitude"], place["osm"]["longitude"]) * 1000 <= NEAR_METRES]
        category = item["categories"][0]
        reasons = []
        if city_basis.startswith("missing"):
            reasons.append("VERIFY_CITY_WITH_OFFICIAL_SOURCE")
        if len(item["categories"]) > 1:
            reasons.append("AMBIGUOUS_CATEGORY")
        if near:
            reasons.append("NEAR_EXISTING_PLACE")
        if near_manifest:
            reasons.append("NEAR_MANIFEST_PLACE")
        if not any(item["tags"].get(key) for key in CORROBORATION):
            reasons.append("LIMITED_OSM_METADATA")
        preliminary.append({"name": item["name"], "destination": city, "category": category,
                            "osm": {"type": item["osmType"], "id": item["osmId"],
                                    "latitude": item["latitude"], "longitude": item["longitude"],
                                    "addrCity": item["tags"].get("addr:city")},
                            "cityBasis": city_basis, "categories": item["categories"],
                            "distanceKm": round(dict(item["nearby"])[city], 3),
                            "metadataScore": score(item), "reviewReasons": reasons,
                            "nearExistingPlaceIds": near, "nearManifestPlaces": near_manifest,
                            "tags": item["tags"],
                            "reviewStatus": "unverified"})

    preliminary.sort(key=lambda row: (row["cityBasis"] != "addr_city_match",
                                      -row["metadataScore"], len(row["reviewReasons"]),
                                      row["distanceKm"], row["name"], row["osm"]["type"], row["osm"]["id"]))
    deduped = []
    by_name = defaultdict(list)
    for item in preliminary:
        key = norm(item["name"])
        if any(distance_km(item["osm"]["latitude"], item["osm"]["longitude"],
                           other["osm"]["latitude"], other["osm"]["longitude"]) * 1000 <= OSM_NAME_DEDUP_METRES
               for other in by_name[key]):
            exclusions["OSM_NEAR_NAME_DUPLICATE"] += 1
            continue
        by_name[key].append(item)
        deduped.append(item)

    selected = []
    category_selected = Counter()
    brand_total, brand_city = Counter(), Counter()
    quotas = {}
    for city, config in CITY_TARGETS.items():
        gap = max(0, config[0] - counts[city])
        quotas[city] = {category: math.ceil(gap * weight * multiplier)
                        for category, weight in CATEGORY_WEIGHTS.items()}
    for item in deduped:
        city, category = item["destination"], item["category"]
        if category_selected[city, category] >= quotas[city][category]:
            exclusions["CATEGORY_POOL_CAP"] += 1
            continue
        brand = brand_of(item)
        if brand and (brand_total[brand] >= max_brand or brand_city[city, brand] >= 1):
            exclusions["CHAIN_CAP"] += 1
            continue
        item["brandKey"] = brand or None
        selected.append(item)
        category_selected[city, category] += 1
        if brand:
            brand_total[brand] += 1
            brand_city[city, brand] += 1
    selected.sort(key=lambda row: (list(CITY_TARGETS).index(row["destination"]),
                                   list(CATEGORY_WEIGHTS).index(row["category"]),
                                   row["cityBasis"] != "addr_city_match",
                                   -row["metadataScore"], row["name"], row["osm"]["id"]))
    return {"scope": {"radiusKm": RADIUS_KM, "nearExistingMeters": NEAR_METRES,
                      "osmNearNameDedupMeters": OSM_NAME_DEDUP_METRES,
                      "cityTargets": {city: config[0] for city, config in CITY_TARGETS.items()},
                      "categoryWeights": CATEGORY_WEIGHTS, "reviewPoolMultiplier": multiplier,
                      "maxChainGlobal": max_brand, "maxChainPerCity": 1},
            "summary": {"rawObjectsInRadius": len(records), "afterBasicAndDatabaseChecks": len(preliminary),
                        "afterOsmDedup": len(deduped), "selectedForReview": len(selected),
                        "currentPublicByCity": dict(counts), "exclusions": dict(exclusions),
                        "selectedWithMatchingAddrCity": sum(row["cityBasis"] == "addr_city_match" for row in selected),
                        "selectedByCityCategory": {city: {category: category_selected[city, category]
                                                         for category in CATEGORY_WEIGHTS} for city in CITY_TARGETS},
                        "reviewPoolCaps": quotas},
            "candidates": selected}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pbf", type=Path, default=DEFAULT_PBF)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--pool-multiplier", type=float, default=2.0)
    parser.add_argument("--max-chain", type=int, default=2)
    args = parser.parse_args()
    if args.pool_multiplier <= 0 or args.max_chain < 1:
        parser.error("Pool multiplier and chain cap must be positive.")
    started = time.perf_counter()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    digest = hashlib.sha256()
    with args.pbf.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    pbf_hash = digest.hexdigest()
    if pbf_hash != manifest["osmSnapshot"]["localSha256"]:
        raise ValueError("PBF checksum differs from the source-verified manifest.")
    if args.cache.exists():
        cached = json.loads(args.cache.read_text(encoding="utf-8"))
        if cached.get("pbfSha256") != pbf_hash:
            raise ValueError("Extracted cache checksum differs from PBF.")
        records = cached["records"]
        used_cache = True
    else:
        handler = Extractor()
        handler.apply_file(str(args.pbf), locations=True, idx="flex_mem")
        records = list(handler.records.values())
        args.cache.parent.mkdir(parents=True, exist_ok=True)
        args.cache.write_text(json.dumps({"pbfSha256": pbf_hash, "records": records},
                                         ensure_ascii=False), encoding="utf-8")
        used_cache = False
    extracted_at = time.perf_counter()
    existing, counts = read_existing()
    result = select(records, existing, counts, manifest,
                    args.pool_multiplier, args.max_chain)
    result["source"] = {"pbfSha256": pbf_hash, "manifest": str(args.manifest)}
    result["generatedAt"] = datetime.now(timezone.utc).isoformat()
    result["timingSeconds"] = {"hashAndExtract": round(extracted_at - started, 2),
                               "selection": round(time.perf_counter() - extracted_at, 2),
                               "usedCache": used_cache}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"summary": result["summary"], "timingSeconds": result["timingSeconds"],
                      "output": str(args.output)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
