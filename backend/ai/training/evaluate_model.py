from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


BACKEND_DIR = Path(__file__).resolve().parents[2]

DATA_FILE = (
    BACKEND_DIR
    / "ai"
    / "data"
    / "training_data.csv"
)

MODEL_FILE = (
    BACKEND_DIR
    / "ai"
    / "model"
    / "recommendation_model.pkl"
)

EVALUATION_FILE = (
    BACKEND_DIR
    / "ai"
    / "model"
    / "evaluation_metrics.json"
)

K = 5

FEATURE_COLUMNS = [
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

TARGET_COLUMN = "interaction_score"


def precision_at_k(
    ranked_scores: np.ndarray,
    k: int,
    relevance_threshold: float = 4.0,
) -> float:
    top_k = ranked_scores[:k]

    relevant = np.sum(
        top_k >= relevance_threshold
    )

    return float(relevant / k)


def recall_at_k(
    ranked_scores: np.ndarray,
    total_relevant: int,
    k: int,
    relevance_threshold: float = 4.0,
) -> float:
    if total_relevant == 0:
        return 0.0

    top_k = ranked_scores[:k]

    relevant = np.sum(
        top_k >= relevance_threshold
    )

    return float(
        relevant / total_relevant
    )


def dcg_at_k(
    scores: np.ndarray,
    k: int,
) -> float:
    scores = scores[:k]

    if len(scores) == 0:
        return 0.0

    discounts = np.log2(
        np.arange(2, len(scores) + 2)
    )

    return float(
        np.sum(
            (2**scores - 1)
            / discounts
        )
    )


def ndcg_at_k(
    true_scores: np.ndarray,
    predicted_scores: np.ndarray,
    k: int,
) -> float:
    predicted_order = np.argsort(
        -predicted_scores
    )

    ranked_true = true_scores[
        predicted_order
    ]

    ideal_true = np.sort(
        true_scores
    )[::-1]

    dcg = dcg_at_k(
        ranked_true,
        k,
    )

    ideal_dcg = dcg_at_k(
        ideal_true,
        k,
    )

    if ideal_dcg == 0:
        return 0.0

    return float(
        dcg / ideal_dcg
    )


def evaluate_model() -> dict:
    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_FILE}"
        )

    if not MODEL_FILE.exists():
        raise FileNotFoundError(
            f"Model not found: {MODEL_FILE}"
        )

    df = pd.read_csv(DATA_FILE)

    model = joblib.load(MODEL_FILE)

    ml_precision = []
    ml_recall = []
    ml_ndcg = []

    baseline_precision = []
    baseline_recall = []
    baseline_ndcg = []

    for user_id, user_df in df.groupby(
        "user_id"
    ):
        X = user_df[FEATURE_COLUMNS]

        true_scores = (
            user_df[TARGET_COLUMN]
            .astype(float)
            .to_numpy()
        )

        # ML model prediction
        predicted_scores = model.predict(X)

        ml_order = np.argsort(
            -predicted_scores
        )

        ml_ranked_true = true_scores[
            ml_order
        ]

        total_relevant = int(
            np.sum(true_scores >= 4.0)
        )

        ml_precision.append(
            precision_at_k(
                ml_ranked_true,
                K,
            )
        )

        ml_recall.append(
            recall_at_k(
                ml_ranked_true,
                total_relevant,
                K,
            )
        )

        ml_ndcg.append(
            ndcg_at_k(
                true_scores,
                predicted_scores,
                K,
            )
        )

        # Rating-only baseline
        baseline_scores = (
            user_df["rating"]
            .astype(float)
            .to_numpy()
        )

        baseline_order = np.argsort(
            -baseline_scores
        )

        baseline_ranked_true = (
            true_scores[
                baseline_order
            ]
        )

        baseline_precision.append(
            precision_at_k(
                baseline_ranked_true,
                K,
            )
        )

        baseline_recall.append(
            recall_at_k(
                baseline_ranked_true,
                total_relevant,
                K,
            )
        )

        baseline_ndcg.append(
            ndcg_at_k(
                true_scores,
                baseline_scores,
                K,
            )
        )

        print(
            f"Evaluated user: {user_id}"
        )

    results = {
        "dataset_rows": int(len(df)),
        "users": int(df["user_id"].nunique()),
        "k": K,
        "relevance_threshold": 4,
        "metrics": {
            "ml_model": {
                "precision_at_5": round(
                    float(
                        np.mean(
                            ml_precision
                        )
                    ),
                    4,
                ),
                "recall_at_5": round(
                    float(
                        np.mean(
                            ml_recall
                        )
                    ),
                    4,
                ),
                "ndcg_at_5": round(
                    float(
                        np.mean(
                            ml_ndcg
                        )
                    ),
                    4,
                ),
            },
            "rating_baseline": {
                "precision_at_5": round(
                    float(
                        np.mean(
                            baseline_precision
                        )
                    ),
                    4,
                ),
                "recall_at_5": round(
                    float(
                        np.mean(
                            baseline_recall
                        )
                    ),
                    4,
                ),
                "ndcg_at_5": round(
                    float(
                        np.mean(
                            baseline_ndcg
                        )
                    ),
                    4,
                ),
            },
        },
        "warning": (
            "The current dataset is a small "
            "development dataset. Evaluation "
            "results must not be presented as "
            "final generalization performance."
        ),
    }

    return results


def main() -> None:
    print(
        "Evaluating TravelMate "
        "recommendation model..."
    )

    results = evaluate_model()

    EVALUATION_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with EVALUATION_FILE.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            results,
            file,
            indent=2,
        )

    print()
    print("Evaluation complete.")
    print(
        json.dumps(
            results["metrics"],
            indent=2,
        )
    )
    print(
        f"Evaluation saved: "
        f"{EVALUATION_FILE}"
    )


if __name__ == "__main__":
    main()