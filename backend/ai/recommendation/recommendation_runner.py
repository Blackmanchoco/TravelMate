from __future__ import annotations

import json
import sys
import traceback
from typing import Any

import pandas as pd
import psycopg2

from recommender import NoPreferenceError, recommend_with_metadata


def write_response(payload: dict[str, Any]) -> None:
    sys.stdout.write(
        json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
            allow_nan=False,
        )
    )
    sys.stdout.write("\n")
    sys.stdout.flush()


def validate_input(payload: Any) -> tuple[str, int, int | None]:
    if not isinstance(payload, dict):
        raise ValueError("Input must be a JSON object.")

    user_id = payload.get("userId")
    limit = payload.get("limit")
    destination_id = payload.get("destinationId")

    if not isinstance(user_id, str) or not user_id.strip():
        raise ValueError("userId must be a non-empty string.")

    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 20:
        raise ValueError("limit must be an integer between 1 and 20.")

    if destination_id is not None and (
        isinstance(destination_id, bool)
        or not isinstance(destination_id, int)
        or destination_id < 1
    ):
        raise ValueError("destinationId must be null or a positive integer.")

    return user_id.strip(), limit, destination_id


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        user_id, limit, destination_id = validate_input(payload)
    except (json.JSONDecodeError, ValueError) as error:
        write_response(
            {
                "ok": False,
                "error": {
                    "code": "INVALID_INPUT",
                    "message": str(error),
                },
            }
        )
        return 2

    try:
        items, skipped = recommend_with_metadata(
            user_id=user_id,
            top_n=limit,
            destination_id=destination_id,
        )
    except NoPreferenceError:
        write_response(
            {
                "ok": False,
                "error": {
                    "code": "NO_PREFERENCE_SET",
                    "message": "No user preference has been set.",
                },
            }
        )
        return 3
    except (psycopg2.Error, pd.errors.DatabaseError):
        write_response(
            {
                "ok": False,
                "error": {
                    "code": "RECOMMENDER_DB_ERROR",
                    "message": "Recommendation database query failed.",
                },
            }
        )
        return 4
    except Exception:
        traceback.print_exc(file=sys.stderr)
        write_response(
            {
                "ok": False,
                "error": {
                    "code": "RECOMMENDER_ERROR",
                    "message": "Recommendation generation failed.",
                },
            }
        )
        return 4

    write_response(
        {
            "ok": True,
            "modelVersion": "v1",
            "algorithm": "hybrid",
            "items": items,
            "skippedCandidates": skipped,
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
