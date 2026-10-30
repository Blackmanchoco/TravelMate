from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


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

METRICS_FILE = (
    BACKEND_DIR
    / "ai"
    / "model"
    / "training_metrics.json"
)


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


def load_dataset() -> pd.DataFrame:
    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Training dataset not found: {DATA_FILE}"
        )

    df = pd.read_csv(DATA_FILE)

    required_columns = [
        *FEATURE_COLUMNS,
        TARGET_COLUMN,
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "Dataset is missing required columns: "
            + ", ".join(missing_columns)
        )

    if len(df) < 10:
        raise ValueError(
            "Dataset is too small for the training pipeline."
        )

    return df


def build_pipeline() -> Pipeline:
    categorical_features = [
        "budget",
        "travel_style",
        "preferred_transportation",
        "trip_duration",
        "place_category",
    ]

    numerical_features = [
        "interest_match",
        "activity_match",
        "budget_match",
        "rating",
        "price_level",
    ]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(
                    handle_unknown="ignore"
                ),
                categorical_features,
            ),
            (
                "numerical",
                "passthrough",
                numerical_features,
            ),
        ]
    )

    model = RandomForestRegressor(
        n_estimators=200,
        random_state=42,
        min_samples_leaf=2,
        n_jobs=-1,
    )

    return Pipeline(
        steps=[
            (
                "preprocessor",
                preprocessor,
            ),
            (
                "model",
                model,
            ),
        ]
    )


def main() -> None:
    print("Loading TravelMate training dataset...")

    df = load_dataset()

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN].astype(float)

    print(f"Dataset rows: {len(df)}")
    print(
        "Target distribution:"
        f"\n{y.value_counts().sort_index()}"
    )

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    print(f"Training rows: {len(X_train)}")
    print(f"Testing rows: {len(X_test)}")

    pipeline = build_pipeline()

    print("Training Random Forest recommendation model...")

    pipeline.fit(X_train, y_train)

    predictions = pipeline.predict(X_test)

    mae = mean_absolute_error(
        y_test,
        predictions,
    )

    mse = mean_squared_error(
        y_test,
        predictions,
    )

    rmse = mse ** 0.5

    MODEL_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    joblib.dump(
        pipeline,
        MODEL_FILE,
    )

    metrics = {
        "dataset_rows": int(len(df)),
        "training_rows": int(len(X_train)),
        "testing_rows": int(len(X_test)),
        "model": "RandomForestRegressor",
        "random_state": 42,
        "n_estimators": 200,
        "metrics": {
            "mae": round(float(mae), 4),
            "rmse": round(float(rmse), 4),
        },
        "warning": (
            "This dataset is a small development dataset "
            "and should not be used as the final model "
            "accuracy claim."
        ),
    }

    with METRICS_FILE.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            metrics,
            file,
            indent=2,
        )

    print()
    print("Training complete.")
    print(f"MAE: {mae:.4f}")
    print(f"RMSE: {rmse:.4f}")
    print(f"Model saved: {MODEL_FILE}")
    print(f"Metrics saved: {METRICS_FILE}")


if __name__ == "__main__":
    main()