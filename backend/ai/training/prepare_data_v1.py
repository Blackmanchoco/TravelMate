from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import psycopg2
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"
OUTPUT_FILE = BACKEND_DIR / "ai" / "data" / "training_data.csv"
NEUTRAL_RATING = 2.5


def load_database_config() -> dict[str, Any]:
    load_dotenv(ENV_FILE)

    import os

    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL was not found in backend/.env"
        )

    parsed = urlsplit(database_url)

    if not parsed.hostname or not parsed.username:
        raise RuntimeError(
            "DATABASE_URL is invalid."
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

    value = value.lower().strip()

    return re.sub(r"[^a-z0-9]+", " ", value)


def parse_array(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, list):
        return [str(item) for item in value]

    return [str(value)]


def rating_value(value: Any) -> float:
    """Return a neutral midpoint when a place has no rating data."""
    if value is None:
        return NEUTRAL_RATING

    return float(value)


def category_matches_interests(
    category: str,
    interests: list[str],
) -> int:
    category_normalized = normalize(category)
    interest_values = {
        normalize(item)
        for item in interests
    }

    if not interest_values:
        return 0

    category_map = {
        "nature": {"nature", "beach", "outdoor"},
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

    for interest in interest_values:
        mapped_categories = category_map.get(
            interest,
            {interest},
        )

        if category_normalized in mapped_categories:
            return 1

    return 0


def activity_matches_category(
    category: str,
    activities: list[str],
) -> int:
    category_normalized = normalize(category)

    activity_map = {
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

    for activity in activities:
        activity_normalized = normalize(activity)

        allowed_categories = activity_map.get(
            activity_normalized,
            set(),
        )

        if category_normalized in allowed_categories:
            return 1

    return 0


def budget_price_match(
    budget: str | None,
    price_level: int | None,
) -> float:
    if price_level is None:
        return 0.5

    budget_normalized = normalize(budget)

    if budget_normalized in {
        "low",
        "budget",
        "low budget",
    }:
        return 1.0 if price_level <= 2 else 0.0

    if budget_normalized in {
        "moderate",
        "mid range",
        "midrange",
    }:
        return 1.0 if price_level <= 2 else 0.5

    if budget_normalized in {
        "high",
        "luxury",
    }:
        return 1.0 if price_level >= 3 else 0.5

    return 0.5


def interaction_score(
    place_id: int,
    saved_place_ids: set[int],
    itinerary_place_ids: set[int],
) -> tuple[int, str]:
    if place_id in itinerary_place_ids:
        return 5, "itinerary"

    if place_id in saved_place_ids:
        return 4, "saved"

    return 0, "none"


def fetch_training_rows(connection) -> list[dict[str, Any]]:
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
            p.name AS place_name,
            p.category,
            p.rating,
            p."priceLevel",

            d.id AS destination_id,
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


def fetch_interactions(connection):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT "userId", "placeId"
            FROM saved_places
            """
        )

        saved = {
            (user_id, place_id)
            for user_id, place_id in cursor.fetchall()
        }

        cursor.execute(
            """
            SELECT i."userId", ii."placeId"
            FROM itineraries i
            INNER JOIN itinerary_items ii
                ON ii."itineraryId" = i.id
            """
        )

        itinerary = {
            (user_id, place_id)
            for user_id, place_id in cursor.fetchall()
        }

    return saved, itinerary


def build_dataset() -> list[dict[str, Any]]:
    config = load_database_config()

    connection = psycopg2.connect(**config)

    try:
        base_rows = fetch_training_rows(connection)
        saved, itinerary = fetch_interactions(connection)

        dataset = []

        for row in base_rows:
            user_id = row["user_id"]
            place_id = row["place_id"]

            interests = parse_array(row["interests"])
            activities = parse_array(
                row["preferredActivities"]
            )

            interaction, interaction_type = interaction_score(
                place_id,
                {
                    p
                    for u, p in saved
                    if u == user_id
                },
                {
                    p
                    for u, p in itinerary
                    if u == user_id
                },
            )

            dataset.append(
                {
                    "user_id": user_id,
                    "destination_id": row["destination_id"],
                    "destination_name": row["destination_name"],
                    "city": row["city"],
                    "state": row["state"],
                    "place_id": place_id,
                    "place_name": row["place_name"],
                    "place_category": row["category"],
                    "rating": rating_value(row["rating"]),
                    "price_level": row["priceLevel"]
                    if row["priceLevel"] is not None
                    else 0,
                    "budget": row["budget"] or "",
                    "travel_style": row["travelStyle"] or "",
                    "interest_match": category_matches_interests(
                        row["category"],
                        interests,
                    ),
                    "activity_match": activity_matches_category(
                        row["category"],
                        activities,
                    ),
                    "budget_match": budget_price_match(
                        row["budget"],
                        row["priceLevel"],
                    ),
                    "preferred_transportation": (
                        row["preferredTransportation"]
                        or ""
                    ),
                    "trip_duration": (
                        row["tripDuration"]
                        or ""
                    ),
                    "dietary_preferences": "|".join(
                        parse_array(
                            row["dietaryPreferences"]
                        )
                    ),
                    "interaction_type": interaction_type,
                    "interaction_score": interaction,
                }
            )

        return dataset

    finally:
        connection.close()


def save_dataset(rows: list[dict[str, Any]]) -> None:
    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    if not rows:
        raise RuntimeError(
            "No dataset rows were generated."
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
    print("Generating TravelMate training dataset...")

    rows = build_dataset()

    save_dataset(rows)

    positive_rows = sum(
        1
        for row in rows
        if row["interaction_score"] > 0
    )

    print(f"Generated rows: {len(rows)}")
    print(f"Positive interaction rows: {positive_rows}")
    print(f"Output: {OUTPUT_FILE}")
    print("Dataset generation complete.")


if __name__ == "__main__":
    main()
