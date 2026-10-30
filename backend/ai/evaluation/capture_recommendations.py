"""Capture reproducible recommendation inputs and outputs for offline evaluation.

This script calls the recommendation logic directly. It is deliberately separate
from the Express endpoint and does not add production request logging.
Set TRAVELMATE_EVALUATION_PROFILE_EMAIL to the email of the
profile_local_food_photography test account before running it. Database
credentials come from DATABASE_URL in the environment or backend/.env.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import platform
import re
import sys
import warnings
from datetime import datetime
from pathlib import Path
from time import perf_counter
from typing import Any
from zoneinfo import ZoneInfo


BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent
LOCAL_TIMEZONE = ZoneInfo("Asia/Kuala_Lumpur")

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from ai.recommendation.recommender import (  # noqa: E402
    MODEL_FILE,
    get_connection,
    get_places,
    recommend,
)

MODEL_PATH = MODEL_FILE


TEST_PROFILES = (
    {
        "alias": "profile_culture_food_nature",
        "email": "preference-match-normal-20260916-01@travelmate.test",
        "email_env": "TRAVELMATE_EVALUATION_PROFILE_A_EMAIL",
    },
    {
        "alias": "profile_culture_food_walking",
        "email": "phase2-d-a-20260919@travelmate.test",
        "email_env": "TRAVELMATE_EVALUATION_PROFILE_B_EMAIL",
    },
    {
        "alias": "profile_local_food_photography",
        "email_env": "TRAVELMATE_EVALUATION_PROFILE_EMAIL",
    },
)

PACKAGE_NAMES = (
    "joblib",
    "numpy",
    "pandas",
    "psycopg2-binary",
    "python-dotenv",
    "scikit-learn",
    "scipy",
)


def parse_args() -> argparse.Namespace:
    default_directory = (
        PROJECT_DIR
        / "docs"
        / f"recommendation-evaluation-{datetime.now(LOCAL_TIMEZONE):%Y-%m-%d}"
    )
    parser = argparse.ArgumentParser(
        description="Capture a fixed recommendation evaluation matrix as JSON."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=default_directory,
        help="Directory for the timestamped JSON artifact.",
    )
    return parser.parse_args()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def anonymize_user_id(user_id: str) -> str:
    return hashlib.sha256(f"travelmate-evaluation:{user_id}".encode()).hexdigest()[:16]


def package_versions() -> dict[str, str]:
    versions: dict[str, str] = {}
    for package_name in PACKAGE_NAMES:
        try:
            versions[package_name] = importlib.metadata.version(package_name)
        except importlib.metadata.PackageNotFoundError:
            versions[package_name] = "NOT_INSTALLED"
    return versions


def resolve_profiles() -> list[dict[str, Any]]:
    profile_emails: list[str] = []
    for profile in TEST_PROFILES:
        if "email_env" in profile:
            profile_email = os.getenv(profile["email_env"], "").strip()
            if not profile_email and "email" in profile:
                profile_email = profile["email"]
            if not profile_email:
                raise RuntimeError(
                    f"{profile['email_env']} is required for the evaluation test profile."
                )
        else:
            profile_email = profile["email"]
        profile_emails.append(profile_email)

    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            resolved: list[dict[str, Any]] = []
            for profile, profile_email in zip(TEST_PROFILES, profile_emails):
                cursor.execute(
                    """
                    SELECT
                        u.id,
                        up.interests,
                        up."travelStyle",
                        up.budget,
                        up."preferredActivities",
                        up."dietaryPreferences",
                        up."preferredTransportation",
                        up."tripDuration"
                    FROM users u
                    JOIN user_preferences up ON up."userId" = u.id
                    WHERE u.email = %s
                    """,
                    (profile_email,),
                )
                row = cursor.fetchone()
                if row is None:
                    raise RuntimeError(
                        f"Configured evaluation profile is missing: {profile['alias']}"
                    )

                resolved.append(
                    {
                        "alias": profile["alias"],
                        "userId": row[0],
                        "anonymizedUserIdentifier": anonymize_user_id(row[0]),
                        "preferenceSnapshot": {
                            "interests": row[1],
                            "travelStyle": row[2],
                            "budget": row[3],
                            "preferredActivities": row[4],
                            "dietaryPreferences": row[5],
                            "preferredTransportation": row[6],
                            "tripDuration": row[7],
                        },
                    }
                )
            return resolved
    finally:
        connection.close()


def destination_case_label(name: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", name.casefold()).strip("_")
    return f"{normalized}_top_3"


def resolve_parameter_matrix() -> list[dict[str, Any]]:
    """Build one evaluation case for every Destination currently in the DB."""
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT id, name FROM destinations ORDER BY name ASC')
            destinations = [
                {"id": int(destination_id), "name": str(name)}
                for destination_id, name in cursor.fetchall()
            ]
            cursor.execute('SELECT COALESCE(MAX(id), 0) FROM destinations')
            missing_destination_id = int(cursor.fetchone()[0]) + 1000
    finally:
        connection.close()

    return [
        {
            "label": "global_top_5",
            "destinationName": None,
            "destinationId": None,
            "limit": 5,
        },
        *[
            {
                "label": destination_case_label(destination["name"]),
                "destinationName": destination["name"],
                "destinationId": destination["id"],
                "limit": 3,
            }
            for destination in destinations
        ],
        {
            "label": "missing_destination",
            "destinationName": "__missing__",
            "destinationId": missing_destination_id,
            "limit": 5,
        },
    ]


def capture_case(
    profile: dict[str, Any], parameters: dict[str, Any]
) -> dict[str, Any]:
    case_id = f"{profile['alias']}__{parameters['label']}"
    case_input = {
        "userAlias": profile["alias"],
        "anonymizedUserIdentifier": profile["anonymizedUserIdentifier"],
        "destinationName": parameters["destinationName"],
        "destinationId": parameters["destinationId"],
        "limit": parameters["limit"],
    }

    started_at = perf_counter()
    try:
        candidates = get_places(parameters["destinationId"])
        items = recommend(
            profile["userId"],
            destination_id=parameters["destinationId"],
            top_n=parameters["limit"],
        )
        duration_ms = round((perf_counter() - started_at) * 1000, 3)
        return {
            "caseId": case_id,
            "input": case_input,
            "modelVersion": "v1",
            "candidateCount": len(candidates),
            "returnedCount": len(items),
            "durationMs": duration_ms,
            "success": True,
            "error": None,
            "output": items,
        }
    except Exception as error:  # Capture failures as evaluation evidence.
        duration_ms = round((perf_counter() - started_at) * 1000, 3)
        return {
            "caseId": case_id,
            "input": case_input,
            "modelVersion": "v1",
            "candidateCount": None,
            "returnedCount": 0,
            "durationMs": duration_ms,
            "success": False,
            "error": {
                "type": type(error).__name__,
                "message": str(error),
            },
            "output": [],
        }


def main() -> int:
    args = parse_args()
    output_directory = args.output_dir.resolve()
    output_directory.mkdir(parents=True, exist_ok=True)

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Recommendation model not found: {MODEL_PATH}")

    captured_at = datetime.now(LOCAL_TIMEZONE)
    profiles = resolve_profiles()
    parameter_matrix = resolve_parameter_matrix()

    cases = [
        capture_case(profile, parameters)
        for profile in profiles
        for parameters in parameter_matrix
    ]
    success_count = sum(1 for case in cases if case["success"])

    artifact = {
        "schemaVersion": 1,
        "capturedAt": captured_at.isoformat(),
        "captureMode": "direct_recommendation_logic",
        "model": {
            "version": "v1",
            "path": str(MODEL_PATH.relative_to(PROJECT_DIR)).replace("\\", "/"),
            "sha256": sha256_file(MODEL_PATH),
            "sizeBytes": MODEL_PATH.stat().st_size,
        },
        "runtime": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "packages": package_versions(),
        },
        "method": {
            "profileCount": len(profiles),
            "parameterCombinationCount": len(parameter_matrix),
            "plannedCaseCount": len(profiles) * len(parameter_matrix),
            "durationDefinition": (
                "Wall-clock milliseconds for candidate retrieval plus recommend() execution."
            ),
            "rankingFieldsCaptured": [
                "placeId",
                "rank",
                "mlRankScore",
                "finalScore",
                "reason",
            ],
        },
        "profiles": [
            {
                "alias": profile["alias"],
                "anonymizedUserIdentifier": profile["anonymizedUserIdentifier"],
                "preferenceSnapshot": profile["preferenceSnapshot"],
            }
            for profile in profiles
        ],
        "parameterMatrix": parameter_matrix,
        "summary": {
            "caseCount": len(cases),
            "successCount": success_count,
            "failureCount": len(cases) - success_count,
        },
        "cases": cases,
        "limitations": [
            "This is a fixed reproducibility capture, not production request telemetry.",
            "The fixed profiles reference seeded/test users that must exist in the database.",
            "The capture records recommendation outputs and latency; it does not establish relevance ground truth.",
            "The recommender is invoked directly, so Express/JWT transport latency is excluded.",
        ],
    }

    timestamp = captured_at.strftime("%Y%m%dT%H%M%S%z")
    output_path = output_directory / f"capture-{timestamp}.json"
    output_path.write_text(
        json.dumps(artifact, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"artifact={output_path}")
    print(f"capturedAt={artifact['capturedAt']}")
    print(f"modelVersion={artifact['model']['version']}")
    print(f"modelSha256={artifact['model']['sha256']}")
    print(f"profiles={len(profiles)}")
    print(f"parameterCombinations={len(parameter_matrix)}")
    print(f"cases={len(cases)}")
    print(f"success={success_count}")
    print(f"failure={len(cases) - success_count}")
    for case in cases:
        print(
            "case="
            f"{case['caseId']} "
            f"success={str(case['success']).lower()} "
            f"candidates={case['candidateCount']} "
            f"returned={case['returnedCount']} "
            f"durationMs={case['durationMs']}"
        )

    return 0 if success_count == len(cases) else 1


if __name__ == "__main__":
    warnings.filterwarnings(
        "ignore",
        message="pandas only supports SQLAlchemy connectable.*",
        category=UserWarning,
    )
    raise SystemExit(main())
