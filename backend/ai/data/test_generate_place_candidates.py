"""Guardrails for the OSM review-pool selector; no network or database needed."""

import unittest
from collections import Counter

from generate_place_candidates import assign_city, select


def record(name, identifier, lat=3.05, lon=101.45, city="Klang", brand=None):
    tags = {"addr:city": city, "website": "https://example.test"} if city else {"website": "https://example.test"}
    if brand:
        tags["brand"] = brand
    return {"osmType": "node", "osmId": identifier, "name": name,
            "categories": ["Restaurant"], "latitude": lat, "longitude": lon,
            "nearby": [["Klang", 1.0], ["Kuala Lumpur", 14.0]],
            "tags": tags, "inactive": False}


class CandidateSelectionTests(unittest.TestCase):
    def setUp(self):
        self.manifest = {"places": [], "heldForReview": []}

    def test_explicit_foreign_city_is_rejected(self):
        self.assertEqual(assign_city(record("A", 1, city="Shah Alam")),
                         (None, "ADDR_CITY_OUTSIDE_TARGET"))

    def test_inactive_restaurant_is_excluded(self):
        closed = record("Closed Restaurant", 1)
        closed["inactive"] = True
        result = select([closed, record("Open Restaurant", 2)], [], Counter(), self.manifest, 2, 2)
        self.assertEqual([item["name"] for item in result["candidates"]], ["Open Restaurant"])
        self.assertEqual(result["summary"]["exclusions"]["NO_NAME_OR_INACTIVE"], 1)

    def test_missing_city_is_flagged_and_known_shah_alam_locality_excluded(self):
        records = [record("I-City Theme Park", 1, city=None),
                   record("Local Cafe", 2, city=None)]
        result = select(records, [], Counter(), self.manifest, 2, 2)
        self.assertEqual([item["name"] for item in result["candidates"]], ["Local Cafe"])
        self.assertIn("VERIFY_CITY_WITH_OFFICIAL_SOURCE", result["candidates"][0]["reviewReasons"])

    def test_archived_existing_name_and_near_same_name_duplicates(self):
        existing = [{"id": 10, "destination": "Klang", "name": "Archived Cafe",
                     "latitude": 3.05, "longitude": 101.45, "archived": True, "category": "Restaurant"}]
        records = [record("Archived Cafe", 1), record("New Cafe", 2),
                   record("New Cafe", 3, lat=3.0501)]
        result = select(records, existing, Counter(), self.manifest, 2, 2)
        self.assertEqual([item["name"] for item in result["candidates"]], ["New Cafe"])
        self.assertEqual(result["summary"]["exclusions"]["OSM_NEAR_NAME_DUPLICATE"], 1)

    def test_brand_cap_within_city(self):
        records = [record("Chain A", 1, brand="Chain"),
                   record("Chain B", 2, lat=3.051, brand="Chain")]
        result = select(records, [], Counter(), self.manifest, 2, 2)
        self.assertEqual(len(result["candidates"]), 1)
        self.assertEqual(result["summary"]["exclusions"]["CHAIN_CAP"], 1)

    def test_alias_near_verified_manifest_place_requires_review(self):
        manifest = {"places": [{"name": "Verified Site", "osm": {
            "type": "way", "id": 99, "latitude": 3.05, "longitude": 101.45}}],
            "heldForReview": []}
        result = select([record("Site Alias", 1, lat=3.0501)], [], Counter(), manifest, 2, 2)
        candidate = result["candidates"][0]
        self.assertEqual(candidate["nearManifestPlaces"], ["Verified Site"])
        self.assertIn("NEAR_MANIFEST_PLACE", candidate["reviewReasons"])


if __name__ == "__main__":
    unittest.main()
