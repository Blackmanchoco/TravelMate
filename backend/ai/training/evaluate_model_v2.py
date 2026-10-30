from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import ndcg_score
from sklearn.model_selection import train_test_split


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "ai" / "data" / "training_data_v2.csv"
MODEL_V1_PATH = BASE_DIR / "ai" / "model" / "recommendation_model.pkl"
MODEL_V2_PATH = BASE_DIR / "ai" / "model" / "recommendation_model_v2.pkl"


def precision_at_k(y_true, y_pred, k=5, threshold=4):
    top_k = np.argsort(y_pred)[::-1][:k]
    relevant = set(np.where(y_true >= threshold)[0])

    if not relevant:
        return 0.0

    hits = sum(1 for idx in top_k if idx in relevant)
    return hits / k


def recall_at_k(y_true, y_pred, k=5, threshold=4):
    top_k = np.argsort(y_pred)[::-1][:k]
    relevant = set(np.where(y_true >= threshold)[0])

    if not relevant:
        return 0.0

    hits = sum(1 for idx in top_k if idx in relevant)
    return hits / len(relevant)


def ndcg_at_k(y_true, y_pred, k=5):
    if len(y_true) == 0:
        return 0.0

    k = min(k, len(y_true))

    true_relevance = np.asarray(y_true).reshape(1, -1)
    predicted_score = np.asarray(y_pred).reshape(1, -1)

    return ndcg_score(true_relevance, predicted_score, k=k)


def evaluate_model(model, X_test, y_test):
    predictions = model.predict(X_test)

    return {
        "precision_at_5": precision_at_k(y_test.values, predictions, k=5),
        "recall_at_5": recall_at_k(y_test.values, predictions, k=5),
        "ndcg_at_5": ndcg_at_k(y_test.values, predictions, k=5),
    }


print("Loading TravelMate evaluation dataset v2...")
df = pd.read_csv(DATA_PATH)

print(f"Dataset rows: {len(df)}")
print(f"Users: {df['user_id'].nunique()}")
print(f"Places: {df['place_id'].nunique()}")

# Use exactly the same split configuration as model training.
train_df, test_df = train_test_split(
    df,
    test_size=0.2,
    random_state=42,
)

# ---------------------------------------------------------
# Feature definitions
# ---------------------------------------------------------

v1_feature_columns = [
    "budget",
    "travel_style",
    "interest_match",
    "activity_match",
    "budget_match",
    "preferred_transportation",
    "trip_duration",
    "rating",
    "price_level",
    "place_category",
]

v2_feature_columns = [
    "budget",
    "travel_style",
    "interest_match",
    "activity_match",
    "budget_match",
    "travel_style_match",
    "tag_match",
    "activity_tag_match",
    "preferred_transportation",
    "trip_duration",
    "place_category",
    "rating_score",
    "price_level",
]

target_column = "interaction_score"

X_test_v1 = test_df[v1_feature_columns]
X_test_v2 = test_df[v2_feature_columns]

y_test = test_df[target_column]


print("\nLoading models...")

model_v1 = joblib.load(MODEL_V1_PATH)
model_v2 = joblib.load(MODEL_V2_PATH)

print("Models loaded successfully.")


# ---------------------------------------------------------
# Model v1
# ---------------------------------------------------------

print("\nEvaluating ML model v1...")

metrics_v1 = evaluate_model(
    model_v1,
    X_test_v1,
    y_test,
)

print(f"Precision@5: {metrics_v1['precision_at_5']:.4f}")
print(f"Recall@5:    {metrics_v1['recall_at_5']:.4f}")
print(f"NDCG@5:     {metrics_v1['ndcg_at_5']:.4f}")


# ---------------------------------------------------------
# Model v2
# ---------------------------------------------------------

print("\nEvaluating ML model v2...")

metrics_v2 = evaluate_model(
    model_v2,
    X_test_v2,
    y_test,
)

print(f"Precision@5: {metrics_v2['precision_at_5']:.4f}")
print(f"Recall@5:    {metrics_v2['recall_at_5']:.4f}")
print(f"NDCG@5:     {metrics_v2['ndcg_at_5']:.4f}")


# ---------------------------------------------------------
# Rating baseline
# ---------------------------------------------------------

print("\nEvaluating rating baseline...")

rating_predictions = test_df["rating_score"]

baseline_metrics = {
    "precision_at_5": precision_at_k(
        y_test.values,
        rating_predictions.values,
        k=5,
    ),
    "recall_at_5": recall_at_k(
        y_test.values,
        rating_predictions.values,
        k=5,
    ),
    "ndcg_at_5": ndcg_at_k(
        y_test.values,
        rating_predictions.values,
        k=5,
    ),
}

print(f"Precision@5: {baseline_metrics['precision_at_5']:.4f}")
print(f"Recall@5:    {baseline_metrics['recall_at_5']:.4f}")
print(f"NDCG@5:     {baseline_metrics['ndcg_at_5']:.4f}")


# ---------------------------------------------------------
# Comparison
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("TravelMate Recommendation Model Comparison")
print("=" * 60)

results = pd.DataFrame(
    {
        "Metric": [
            "Precision@5",
            "Recall@5",
            "NDCG@5",
        ],
        "Rating Baseline": [
            baseline_metrics["precision_at_5"],
            baseline_metrics["recall_at_5"],
            baseline_metrics["ndcg_at_5"],
        ],
        "ML v1": [
            metrics_v1["precision_at_5"],
            metrics_v1["recall_at_5"],
            metrics_v1["ndcg_at_5"],
        ],
        "ML v2": [
            metrics_v2["precision_at_5"],
            metrics_v2["recall_at_5"],
            metrics_v2["ndcg_at_5"],
        ],
    }
)

print("\n")
print(results.to_string(index=False))


# ---------------------------------------------------------
# Improvement v2 vs v1
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("ML v2 Improvement vs ML v1")
print("=" * 60)

for metric in [
    "precision_at_5",
    "recall_at_5",
    "ndcg_at_5",
]:
    v1 = metrics_v1[metric]
    v2 = metrics_v2[metric]

    if v1 == 0:
        improvement = 0.0
    else:
        improvement = ((v2 - v1) / v1) * 100

    print(
        f"{metric}: "
        f"{v1:.4f} -> {v2:.4f} "
        f"({improvement:+.2f}%)"
    )


print("\nEvaluation complete.")
print(
    "\nNOTE: This evaluation uses only 30 development records "
    "from 2 users. Results are suitable for prototype validation "
    "but are not representative of final model generalization."
)