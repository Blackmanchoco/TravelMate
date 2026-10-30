from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import joblib
import numpy as np
import pandas as pd
import psycopg2
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[2]

ENV_FILE = BACKEND_DIR / ".env"

MODEL_FILE = (
    BACKEND_DIR
    / "ai"
    / "model"
    / "recommendation_model.pkl"
)

NEUTRAL_RATING = 2.5
NEUTRAL_RATING_SCORE = 0.5


MODEL_FEATURE_COLUMNS = [
    "budget",
    "travel_style",
    "interest_match",
    "activity_match",
    "budget_match",
    "preferred_transportation",
    "trip_duration",
    "place_category",
    "rating",
    "price_level",
]


class NoPreferenceError(ValueError):
    """Raised when a user has not saved recommendation preferences."""


def load_database_config() -> dict[str, Any]:
    load_dotenv(ENV_FILE)

    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL was not found in backend/.env"
        )

    parsed = urlsplit(database_url)

    if not parsed.hostname:
        raise RuntimeError(
            "DATABASE_URL is invalid."
        )

    if not parsed.path:
        raise RuntimeError(
            "DATABASE_URL does not contain a database name."
        )

    return {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "database": parsed.path.lstrip("/"),
        "user": parsed.username,
        "password": parsed.password or "",
    }


def get_connection():
    return psycopg2.connect(
        **load_database_config()
    )


def normalize(value: str | None) -> str:
    if not value:
        return ""

    return (
        value
        .lower()
        .strip()
        .replace("_", " ")
        .replace("-", " ")
    )


def clean_string_list(
    values: Any,
) -> list[str]:
    if values is None:
        return []

    if isinstance(values, list):
        return [
            str(value).strip()
            for value in values
            if str(value).strip()
        ]

    return []


def get_user_preferences(
    user_id: str,
) -> dict[str, Any]:
    query = """
        SELECT
            budget,
            "travelStyle",
            interests,
            "preferredActivities",
            "dietaryPreferences",
            "preferredTransportation",
            "tripDuration"
        FROM user_preferences
        WHERE "userId" = %s
        LIMIT 1;
    """

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                query,
                (user_id,),
            )

            row = cursor.fetchone()

            if row is None:
                raise NoPreferenceError(
                    f"No preferences found for user: {user_id}"
                )

            return {
                "budget": row[0],
                "travelStyle": row[1],
                "interests": clean_string_list(row[2]),
                "preferredActivities": clean_string_list(
                    row[3]
                ),
                "dietaryPreferences": clean_string_list(
                    row[4]
                ),
                "preferredTransportation": row[5],
                "tripDuration": row[6],
            }


def get_places(
    destination_id: int | None = None,
) -> pd.DataFrame:
    query = """
        SELECT
            p.id AS place_id,
            p."destinationId" AS destination_id,
            p.name AS place_name,
            p.category AS place_category,
            p.rating,
            p."priceLevel" AS price_level,
            d.name AS destination_name,
            d.city,
            d.state
        FROM places p
        INNER JOIN destinations d
            ON d.id = p."destinationId"
    """

    conditions = [
        "p.category IS DISTINCT FROM %s",
        'p."deletedAt" IS NULL',
    ]
    params: list[Any] = ["Test"]

    if destination_id is not None:
        conditions.append('p."destinationId" = %s')
        params.append(destination_id)

    query += "\n        WHERE " + " AND ".join(conditions)

    query += """
        ORDER BY p.id;
    """

    with get_connection() as connection:
        return pd.read_sql_query(
            query,
            connection,
            params=tuple(params),
        )


def category_matches_interests(
    category: str,
    interests: list[str],
) -> float:
    category_value = normalize(category)

    mapping = {
        "nature": {"nature"},
        "food": {"food", "restaurant"},
        "culture": {"culture", "historical"},
        "history": {"historical", "culture"},
        "shopping": {"shopping"},
        "sightseeing": {
            "attraction",
            "historical",
            "culture",
        },
    }

    if not interests:
        return 0.0

    matches = 0

    for interest in interests:
        interest_value = normalize(interest)

        if category_value in mapping.get(
            interest_value,
            {interest_value},
        ):
            matches += 1

    return min(
        1.0,
        matches / len(interests),
    )


def activity_matches_category(
    category: str,
    activities: list[str],
) -> float:
    category_value = normalize(category)

    mapping = {
        "sightseeing": {
            "attraction",
            "historical",
            "culture",
        },
        "food": {
            "restaurant",
        },
        "beaches": {
            "nature",
        },
        "culture": {
            "culture",
            "historical",
        },
        "photography": {
            "attraction",
            "nature",
            "culture",
            "historical",
        },
    }

    if not activities:
        return 0.0

    matches = 0

    for activity in activities:
        activity_value = normalize(activity)

        if category_value in mapping.get(
            activity_value,
            set(),
        ):
            matches += 1

    return min(
        1.0,
        matches / len(activities),
    )


def budget_price_match(
    budget: str | None,
    price_level: int | None,
) -> float:
    if price_level is None:
        return 0.5

    budget_value = normalize(budget)

    if budget_value in {
        "low",
        "budget",
        "low budget",
    }:
        return 1.0 if price_level <= 2 else 0.0

    if budget_value in {
        "moderate",
        "mid range",
        "midrange",
    }:
        return 1.0 if price_level <= 2 else 0.5

    if budget_value in {
        "high",
        "luxury",
        "relaxed luxury",
    }:
        return 1.0 if price_level >= 2 else 0.5

    return 0.5


def travel_style_match(
    travel_style: str | None,
    category: str,
) -> float:
    """
    Prototype domain mapping between user travel
    style and place category.

    This is a rule-based feature used by the
    hybrid ranking layer.
    """

    style = normalize(travel_style)
    category_value = normalize(category)

    mapping = {
        "relaxed": {
            "nature": 1.0,
            "restaurant": 0.9,
            "culture": 0.8,
            "historical": 0.8,
            "attraction": 0.7,
            "shopping": 0.6,
        },
        "relaxed luxury": {
            "nature": 1.0,
            "restaurant": 1.0,
            "attraction": 0.9,
            "culture": 0.8,
            "historical": 0.8,
            "shopping": 0.8,
        },
        "adventure": {
            "nature": 1.0,
            "attraction": 0.9,
            "historical": 0.5,
            "culture": 0.5,
            "restaurant": 0.4,
            "shopping": 0.3,
        },
        "cultural": {
            "culture": 1.0,
            "historical": 1.0,
            "attraction": 0.8,
            "restaurant": 0.7,
            "nature": 0.5,
            "shopping": 0.4,
        },
        "family": {
            "nature": 0.9,
            "attraction": 0.9,
            "culture": 0.7,
            "historical": 0.7,
            "restaurant": 0.7,
            "shopping": 0.6,
        },
        "luxury": {
            "restaurant": 1.0,
            "attraction": 0.9,
            "shopping": 1.0,
            "nature": 0.7,
            "culture": 0.7,
            "historical": 0.7,
        },
    }

    style_mapping = mapping.get(
        style,
        {},
    )

    return style_mapping.get(
        category_value,
        0.5,
    )


def normalize_rating(
    rating: float | int | None,
) -> float:
    if rating is None or pd.isna(rating):
        return NEUTRAL_RATING_SCORE

    value = rating_value(rating)

    return max(
        0.0,
        min(
            1.0,
            value / 5.0,
        ),
    )


def rating_value(
    rating: float | int | None,
) -> float:
    """Return a finite model feature without pretending it is a real rating."""
    if rating is None or pd.isna(rating):
        return NEUTRAL_RATING

    value = float(rating)

    if not np.isfinite(value):
        return NEUTRAL_RATING

    return value


def public_rating(
    rating: float | int | None,
) -> float | None:
    """Preserve unknown ratings as null in public recommendation output."""
    if rating is None or pd.isna(rating):
        return None

    value = float(rating)

    return value if np.isfinite(value) else None

def load_model():
    if not MODEL_FILE.exists():
        raise FileNotFoundError(
            f"Recommendation model not found: {MODEL_FILE}"
        )

    return joblib.load(MODEL_FILE)


def build_candidate_features(
    places: pd.DataFrame,
    user_preferences: dict[str, Any],
) -> tuple[pd.DataFrame, list[dict[str, float]]]:
    interests = user_preferences.get(
        "interests",
        [],
    )

    activities = user_preferences.get(
        "preferredActivities",
        [],
    )

    budget = user_preferences.get(
        "budget",
        "",
    )

    transportation = user_preferences.get(
        "preferredTransportation",
        "",
    )

    trip_duration = user_preferences.get(
        "tripDuration",
        "",
    )

    travel_style = user_preferences.get(
        "travelStyle",
        "",
    )

    feature_rows = []
    explanations = []

    for _, place in places.iterrows():
        candidate_rating = rating_value(
            place["rating"]
        )

        interest_match = (
            category_matches_interests(
                place["place_category"],
                interests,
            )
        )

        activity_match = (
            activity_matches_category(
                place["place_category"],
                activities,
            )
        )

        budget_match = budget_price_match(
            budget,
            int(place["price_level"])
            if pd.notna(place["price_level"])
            else None,
        )

        style_match = travel_style_match(
            travel_style,
            place["place_category"],
        )

        rating_score = normalize_rating(
            place["rating"]
        )

        feature_rows.append(
            {
                "budget": budget or "",
                "travel_style": travel_style or "",
                "interest_match": interest_match,
                "activity_match": activity_match,
                "budget_match": budget_match,
                "preferred_transportation": (
                    transportation or ""
                ),
                "trip_duration": (
                    trip_duration or ""
                ),
                "place_category": (
                    place["place_category"]
                ),
                "rating": candidate_rating,
                "price_level": int(
                    place["price_level"]
                ),
            }
        )

        explanations.append(
            {
                "interest_match": interest_match,
                "activity_match": activity_match,
                "budget_match": budget_match,
                "travel_style_match": style_match,
                "rating_score": rating_score,
            }
        )

    features = pd.DataFrame(
        feature_rows
    )[MODEL_FEATURE_COLUMNS]

    return features, explanations


def normalize_ml_ranking(
    predictions: np.ndarray,
) -> np.ndarray:
    predictions = np.asarray(
        predictions,
        dtype=float,
    )

    if len(predictions) == 0:
        return predictions

    min_value = np.min(predictions)
    max_value = np.max(predictions)

    if np.isclose(
        min_value,
        max_value,
    ):
        return np.full(
            len(predictions),
            0.5,
        )

    return (
        predictions - min_value
    ) / (
        max_value - min_value
    )


def calculate_hybrid_score(
    ml_rank_score: float,
    interest_match: float,
    activity_match: float,
    budget_match: float,
    travel_style_match_value: float,
    rating_score: float,
) -> float:
    """
    Hybrid v2.2 ranking weights.

    ML ranking       30%
    Interest match   25%
    Activity match   15%
    Budget match     10%
    Travel style     10%
    Rating           10%
    """

    score = (
        ml_rank_score * 0.30
        + interest_match * 0.25
        + activity_match * 0.15
        + budget_match * 0.10
        + travel_style_match_value * 0.10
        + rating_score * 0.10
    )

    return max(
        0.0,
        min(
            1.0,
            score,
        ),
    )


def build_reason(
    interest_match: float,
    activity_match: float,
    budget_match: float,
    travel_style_match_value: float,
    rating_score: float,
) -> list[str]:
    reasons = []

    if interest_match > 0:
        reasons.append(
            "matches your interests"
        )

    if activity_match > 0:
        reasons.append(
            "matches your preferred activities"
        )

    if budget_match >= 1.0:
        reasons.append(
            "fits your budget preference"
        )

    if travel_style_match_value >= 0.8:
        reasons.append(
            "fits your travel style"
        )

    if rating_score >= 0.9:
        reasons.append(
            "has a high rating"
        )

    return reasons


def trained_categories(model: Any) -> set[str]:
    """Read fitted categories from the saved v1 pipeline, without retraining."""
    preprocessor = model.named_steps["preprocessor"]
    for name, encoder, columns in preprocessor.transformers_:
        if name == "categorical":
            position = list(columns).index("place_category")
            return {str(value) for value in encoder.categories_[position]}
    raise ValueError("Saved v1 model has no category encoder")


def filter_v1_candidates(
    places: pd.DataFrame,
    model: Any,
) -> tuple[pd.DataFrame, dict[str, int]]:
    """Exclude unsupported or malformed rows before model feature construction."""
    known = trained_categories(model)
    accepted: list[int] = []
    skipped: dict[str, int] = {}
    for index, row in places.iterrows():
        category = row.get("place_category")
        reason = None
        if not isinstance(category, str) or category not in known:
            reason = "untrainedCategory"
        elif category == "Restaurant":
            # The two v1 rows are both Jalan Alor with interaction_score 0.
            reason = "weakRestaurantTraining"
        else:
            price = pd.to_numeric(row.get("price_level"), errors="coerce")
            rating = row.get("rating")
            valid_rating = rating is None or pd.isna(rating)
            if not valid_rating:
                try:
                    valid_rating = bool(np.isfinite(float(rating)))
                except (TypeError, ValueError):
                    valid_rating = False
            if (
                not isinstance(row.get("place_name"), str)
                or not row["place_name"].strip()
                or not isinstance(row.get("destination_name"), str)
                or not row["destination_name"].strip()
                or not pd.notna(row.get("place_id"))
                or not pd.notna(row.get("destination_id"))
                or not np.isfinite(price)
                or int(price) != price
                or not 1 <= price <= 4
                or not valid_rating
            ):
                reason = "invalidFields"
        if reason:
            skipped[reason] = skipped.get(reason, 0) + 1
        else:
            accepted.append(index)
    return places.loc[accepted].reset_index(drop=True).copy(), skipped


def recommend_with_metadata(
    user_id: str,
    top_n: int = 5,
    destination_id: int | None = None,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    user_preferences = get_user_preferences(
        user_id
    )

    places = get_places(
        destination_id
    )

    model = load_model()
    places, skipped = filter_v1_candidates(places, model)

    if places.empty:
        return [], skipped

    features, explanations = (
        build_candidate_features(
            places,
            user_preferences,
        )
    )

    ml_predictions = model.predict(
        features
    )

    ml_rank_scores = normalize_ml_ranking(
        ml_predictions
    )

    places = places.copy()

    places["ml_prediction"] = (
        ml_predictions
    )

    places["ml_rank_score"] = (
        ml_rank_scores
    )

    final_scores = []

    for index, _ in places.iterrows():
        explanation = explanations[index]

        final_score = calculate_hybrid_score(
            ml_rank_score=float(
                places.loc[
                    index,
                    "ml_rank_score",
                ]
            ),
            interest_match=explanation[
                "interest_match"
            ],
            activity_match=explanation[
                "activity_match"
            ],
            budget_match=explanation[
                "budget_match"
            ],
            travel_style_match_value=explanation[
                "travel_style_match"
            ],
            rating_score=explanation[
                "rating_score"
            ],
        )

        final_scores.append(
            final_score
        )

    places["final_score"] = (
        final_scores
    )

    places["rating_feature"] = places[
        "rating"
    ].map(rating_value)

    places = places.sort_values(
        ["final_score", "rating_feature"],
        ascending=[False, False],
    )

    recommendations = []

    for rank, (_, row) in enumerate(
        places.head(top_n).iterrows(),
        start=1,
    ):
        index = row.name
        explanation = explanations[index]

        recommendations.append(
            {
                "rank": rank,
                "placeId": int(
                    row["place_id"]
                ),
                "placeName": row[
                    "place_name"
                ],
                "destinationId": int(
                    row["destination_id"]
                ),
                "destinationName": row[
                    "destination_name"
                ],
                "category": row[
                    "place_category"
                ],
                "rating": public_rating(
                    row["rating"]
                ),
                "priceLevel": int(
                    row["price_level"]
                ),
                "mlRankScore": round(
                    float(
                        row["ml_rank_score"]
                    ),
                    4,
                ),
                "finalScore": round(
                    float(
                        row["final_score"]
                    ),
                    4,
                ),
                "reason": build_reason(
                    explanation[
                        "interest_match"
                    ],
                    explanation[
                        "activity_match"
                    ],
                    explanation[
                        "budget_match"
                    ],
                    explanation[
                        "travel_style_match"
                    ],
                    explanation[
                        "rating_score"
                    ],
                ),
            }
        )

    return recommendations, skipped


def recommend(
    user_id: str,
    top_n: int = 5,
    destination_id: int | None = None,
) -> list[dict[str, Any]]:
    items, _ = recommend_with_metadata(user_id, top_n, destination_id)
    return items


def print_recommendations(
    user_id: str,
    results: list[dict[str, Any]],
) -> None:
    print(
        f"TravelMate Hybrid v2.2 "
        f"Recommendations"
    )

    print(
        "================================="
    )

    print(
        f"User ID: {user_id}"
    )

    print()

    if not results:
        print("No recommendations found.")
        return

    for item in results:
        print(
            f"{item['rank']}. "
            f"{item['placeName']} "
            f"({item['destinationName']})"
        )

        print(
            f"   ML Rank Score: "
            f"{item['mlRankScore']}"
        )

        print(
            f"   Final Score: "
            f"{item['finalScore']}"
        )

        if item["reason"]:
            print(
                "   Reason: "
                + ", ".join(
                    item["reason"]
                )
            )

        print()


def main() -> None:
    user_id = (
        "cmtr4yy820000jstyz5wpoym0"
    )

    results = recommend(
        user_id=user_id,
        top_n=5,
    )

    print_recommendations(
        user_id,
        results,
    )


if __name__ == "__main__":
    main()
