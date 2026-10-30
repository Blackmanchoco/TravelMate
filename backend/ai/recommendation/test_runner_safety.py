import io
import json
import sys
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

import pandas as pd

from recommender import filter_v1_candidates, load_model
import recommendation_runner


class CandidateSafetyTests(unittest.TestCase):
    def test_unseen_category_and_weak_restaurant_training_are_skipped(self):
        rows = pd.DataFrame([
            {"place_id": 1, "place_name": "Museum", "destination_id": 1,
             "destination_name": "Kuala Lumpur", "place_category": "Culture",
             "rating": 4.0, "price_level": 2},
            {"place_id": 2, "place_name": "Hotel", "destination_id": 1,
             "destination_name": "Kuala Lumpur", "place_category": "Accommodation",
             "rating": None, "price_level": 3},
            {"place_id": 3, "place_name": "Eatery", "destination_id": 1,
             "destination_name": "Kuala Lumpur", "place_category": "Restaurant",
             "rating": None, "price_level": 2},
        ])
        filtered, skipped = filter_v1_candidates(rows, load_model())
        self.assertEqual(filtered.place_id.tolist(), [1])
        self.assertEqual(filtered.index.tolist(), [0])
        self.assertEqual(skipped, {"untrainedCategory": 1, "weakRestaurantTraining": 1})

    def test_null_fields_fail_soft(self):
        rows = pd.DataFrame([
            {"place_id": 1, "place_name": "Museum", "destination_id": 1,
             "destination_name": "Kuala Lumpur", "place_category": "Culture",
             "rating": None, "price_level": 2, "tags": None, "activityTypes": None},
            {"place_id": 2, "place_name": "Broken", "destination_id": 1,
             "destination_name": "Kuala Lumpur", "place_category": "Culture",
             "rating": None, "price_level": None, "tags": None, "activityTypes": None},
            {"place_id": 3, "place_name": None, "destination_id": 1,
             "destination_name": "Kuala Lumpur", "place_category": "Culture",
             "rating": None, "price_level": 2, "tags": None, "activityTypes": None},
        ])
        filtered, skipped = filter_v1_candidates(rows, load_model())
        self.assertEqual(filtered.place_id.tolist(), [1])
        self.assertEqual(filtered.index.tolist(), [0])
        self.assertEqual(skipped, {"invalidFields": 2})

    def test_kept_row_after_skips_has_positional_index(self):
        rows = pd.DataFrame([
            {"place_id": 1, "place_name": "Hotel", "destination_id": 1,
             "destination_name": "Kuala Lumpur", "place_category": "Accommodation",
             "rating": None, "price_level": 2},
            {"place_id": 2, "place_name": "Museum", "destination_id": 1,
             "destination_name": "Kuala Lumpur", "place_category": "Culture",
             "rating": None, "price_level": 2},
        ])
        filtered, _ = filter_v1_candidates(rows, load_model())
        self.assertEqual(filtered.index.tolist(), [0])

    def test_runner_reports_skips_in_response(self):
        output = io.StringIO()
        with patch.object(sys, "stdin", io.StringIO('{"userId":"test","limit":5,"destinationId":null}')):
            with patch.object(recommendation_runner, "recommend_with_metadata", return_value=([], {"untrainedCategory": 1})):
                with redirect_stdout(output):
                    exit_code = recommendation_runner.main()
        self.assertEqual(exit_code, 0)
        self.assertEqual(json.loads(output.getvalue())["skippedCandidates"], {"untrainedCategory": 1})


if __name__ == "__main__":
    unittest.main()
