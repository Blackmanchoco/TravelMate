from __future__ import annotations

import csv
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import psycopg2
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"

OUTPUT_FILE = (
    BACKEND_DIR
    / "ai"
    / "data"
    / "training_data_v2.csv"
)

NEUTRAL_RATING = 2.5
NEUTRAL_RATING_SCORE = 0.5


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


def normalize(value: str | None) -> str:
    if not value:
        return ""

    return (
        value
        .lower()
        .strip()
        .replace("-", " ")
        .replace("_", " ")
    )


def normalize_list(values: Any) -> list[str]:
    if values is None:
        return []

    if isinstance(values, list):
        return [
            normalize(str(value))
            for value in values
            if str(value).strip()
        ]

    return []


def rating_features(value: Any) -> tuple[float, float]:
    """Return raw and normalized rating features without penalizing missing data."""
    if value is None:
        return NEUTRAL_RATING, NEUTRAL_RATING_SCORE

    rating = float(value)
    rating_score = min(
        1.0,
        max(0.0, rating / 5.0),
    )

    return rating, rating_score


def overlap_score(
    user_values: list[str],
    place_values: list[str],
) -> float:
    user_set = {
        normalize(value)
        for value in user_values
    }

    place_set = {
        normalize(value)
        for value in place_values
    }

    if not user_set:
        return 0.0

    matches = user_set.intersection(place_set)

    return min(
        1.0,
        len(matches) / len(user_set),
    )


def category_interest_score(
    category: str,
    interests: list[str],
) -> float:
    category_value = normalize(category)

    mappings = {
        "food": {"restaurant"},
        "nature": {"nature"},
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
        allowed_categories = mappings.get(
            normalize(interest),
            {normalize(interest)},
        )

        if category_value in allowed_categories:
            matches += 1

    return min(
        1.0,
        matches / len(interests),
    )


def category_activity_score(
    category: str,
    activities: list[str],
) -> float:
    category_value = normalize(category)

    mappings = {
        "sightseeing": {
            "attraction",
            "historical",
            "culture",
        },
        "food": {
            "restaurant",
        },
        "local food": {
            "restaurant",
        },
        "photography": {
            "attraction",
            "nature",
            "culture",
            "historical",
        },
        "beaches": {
            "nature",
        },
        "beach": {
            "nature",
        },
        "culture": {
            "culture",
            "historical",
        },
    }

    if not activities:
        return 0.0

    matches = 0

    for activity in activities:
        allowed_categories = mappings.get(
            normalize(activity),
            set(),
        )

        if category_value in allowed_categories:
            matches += 1

    return min(
        1.0,
        matches / len(activities),
    )


def budget_match(
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


def travel_style_score(
    user_style: str | None,
    place_styles: list[str],
) -> float:
    style = normalize(user_style)

    if not style:
        return 0.0

    normalized_places = {
        normalize(value)
        for value in place_styles
    }

    if style in normalized_places:
        return 1.0

    if style == "relaxed luxury":
        if {
            "relaxed",
            "luxury",
        }.intersection(normalized_places):
            return 0.75

    if style == "mid range":
        if "relaxed" in normalized_places:
            return 0.5

    return 0.0


def interaction_label(
    user_id: str,
    place_id: int,
    saved: set[tuple[str, int]],
    itinerary: set[tuple[str, int]],
) -> tuple[int, str]:
    key = (user_id, place_id)

    if key in itinerary:
        return 5, "itinerary"

    if key in saved:
        return 4, "saved"

    return 0, "none"


def fetch_base_rows(connection) -> list[dict[str, Any]]:
    query = """
        SELECT
            u.id AS user_id,

            up.budget,
            up."travelStyle",
            up.interests,
            up."preferredActivities",
            up."dietaryPreferences",
            up."preferredTransportation",
            up."tripDuration",

            p.id AS place_id,
            p."destinationId" AS destination_id,
            p.name AS place_name,
            p.category AS place_category,
            p.rating,
            p."priceLevel" AS price_level,
            p.tags,
            p."travelStyleTags" AS travel_style_tags,
            p."activityTypes" AS activity_types,

            d.name AS destination_name,
            d.city,
            d.state

        FROM users u

        INNER JOIN user_preferences up
            ON up."userId" = u.id

        CROSS JOIN places p

        INNER JOIN destinations d
            ON d.id = p."destinationId"

        WHERE LOWER(TRIM(p.category)) <> 'test'
          AND p."deletedAt" IS NULL

        ORDER BY
            u.id,
            p.id;
    """

    with connection.cursor() as cursor:
        cursor.execute(query)

        columns = [
            description[0]
            for description in cursor.description
        ]

        return [
            dict(zip(columns, row))
            for row in cursor.fetchall()
        ]


def fetch_interactions(
    connection,
) -> tuple[
    set[tuple[str, int]],
    set[tuple[str, int]],
]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT "userId", "placeId"
            FROM saved_places;
            """
        )

        saved = {
            (str(user_id), int(place_id))
            for user_id, place_id in cursor.fetchall()
        }

        cursor.execute(
            """
            SELECT
                i."userId",
                ii."placeId"
            FROM itineraries i
            INNER JOIN itinerary_items ii
                ON ii."itineraryId" = i.id;
            """
        )

        itinerary = {
            (str(user_id), int(place_id))
            for user_id, place_id in cursor.fetchall()
        }

    return saved, itinerary


def build_dataset() -> list[dict[str, Any]]:
    config = load_database_config()

    connection = psycopg2.connect(**config)

    try:
        base_rows = fetch_base_rows(
            connection
        )

        saved, itinerary = fetch_interactions(
            connection
        )

        rows = []

        for row in base_rows:
            interests = normalize_list(
                row["interests"]
            )

            activities = normalize_list(
                row["preferredActivities"]
            )

            place_tags = normalize_list(
                row["tags"]
            )

            place_styles = normalize_list(
                row["travel_style_tags"]
            )

            place_activities = normalize_list(
                row["activity_types"]
            )

            tag_match = overlap_score(
                interests,
                place_tags,
            )

            activity_tag_match = overlap_score(
                activities,
                place_activities,
            )

            category_interest = (
                category_interest_score(
                    row["place_category"],
                    interests,
                )
            )

            category_activity = (
                category_activity_score(
                    row["place_category"],
                    activities,
                )
            )

            interest_match = max(
                tag_match,
                category_interest,
            )

            activity_match = max(
                activity_tag_match,
                category_activity,
            )

            style_match = travel_style_score(
                row["travelStyle"],
                place_styles,
            )

            rating, rating_score = (
                rating_features(row["rating"])
            )

            price_level = (
                int(row["price_level"])
                if row["price_level"] is not None
                else 0
            )

            budget_score = budget_match(
                row["budget"],
                price_level,
            )

            score, interaction_type = (
                interaction_label(
                    str(row["user_id"]),
                    int(row["place_id"]),
                    saved,
                    itinerary,
                )
            )

            rows.append(
                {
                    "user_id": str(
                        row["user_id"]
                    ),
                    "destination_id": int(
                        row["destination_id"]
                    ),
                    "destination_name": row[
                        "destination_name"
                    ],
                    "city": row["city"],
                    "state": row["state"],
                    "place_id": int(
                        row["place_id"]
                    ),
                    "place_name": row[
                        "place_name"
                    ],
                    "place_category": row[
                        "place_category"
                    ],
                    "rating": rating,
                    "rating_score": round(
                        rating_score,
                        4,
                    ),
                    "price_level": price_level,
                    "budget": row["budget"] or "",
                    "travel_style": (
                        row["travelStyle"] or ""
                    ),
                    "interest_match": round(
                        interest_match,
                        4,
                    ),
                    "activity_match": round(
                        activity_match,
                        4,
                    ),
                    "budget_match": round(
                        budget_score,
                        4,
                    ),
                    "travel_style_match": round(
                        style_match,
                        4,
                    ),
                    "tag_match": round(
                        tag_match,
                        4,
                    ),
                    "activity_tag_match": round(
                        activity_tag_match,
                        4,
                    ),
                    "preferred_transportation": (
                        row[
                            "preferredTransportation"
                        ]
                        or ""
                    ),
                    "trip_duration": (
                        row["tripDuration"]
                        or ""
                    ),
                    "dietary_preferences": "|".join(
                        normalize_list(
                            row[
                                "dietaryPreferences"
                            ]
                        )
                    ),
                    "interaction_type": (
                        interaction_type
                    ),
                    "interaction_score": score,
                }
            )

        return rows

    finally:
        connection.close()


def save_dataset(
    rows: list[dict[str, Any]],
) -> None:
    if not rows:
        raise RuntimeError(
            "No dataset rows were generated."
        )

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with OUTPUT_FILE.open(
        "w",
        newline="",
        encoding="utf-8",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=rows[0].keys(),
        )

        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    print(
        "Generating TravelMate "
        "training dataset v2..."
    )

    rows = build_dataset()

    save_dataset(rows)

    positive_rows = sum(
        1
        for row in rows
        if row["interaction_score"] > 0
    )

    unique_users = len(
        {
            row["user_id"]
            for row in rows
        }
    )

    unique_places = len(
        {
            row["place_id"]
            for row in rows
        }
    )

    print(
        f"Generated rows: {len(rows)}"
    )

    print(
        f"Users: {unique_users}"
    )

    print(
        f"Places: {unique_places}"
    )

    print(
        f"Positive interaction rows: "
        f"{positive_rows}"
    )

    print(
        f"Output: {OUTPUT_FILE}"
    )

    print(
        "Dataset v2 generation complete."
    )


if __name__ == "__main__":
    main()
