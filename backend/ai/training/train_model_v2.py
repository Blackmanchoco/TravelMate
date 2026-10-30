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
    / "training_data_v2.csv"
)

MODEL_FILE = (
    BACKEND_DIR
    / "ai"
    / "model"
    / "recommendation_model_v2.pkl"
)

METRICS_FILE = (
    BACKEND_DIR
    / "ai"
    / "model"
    / "training_metrics_v2.json"
)


FEATURE_COLUMNS = [
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

TARGET_COLUMN = "interaction_score"


def load_dataset() -> pd.DataFrame:
    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_FILE}"
        )

    df = pd.read_csv(DATA_FILE)

    required_columns = [
        *FEATURE_COLUMNS,
        TARGET_COLUMN,
    ]

    missing = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            "Missing columns: "
            + ", ".join(missing)
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
        "travel_style_match",
        "tag_match",
        "activity_tag_match",
        "rating_score",
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
        n_estimators=300,
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
    print(
        "Loading TravelMate "
        "training dataset v2..."
    )

    df = load_dataset()

    X = df[FEATURE_COLUMNS]

    y = (
        df[TARGET_COLUMN]
        .astype(float)
    )

    print(
        f"Dataset rows: {len(df)}"
    )

    print(
        f"Users: {df['user_id'].nunique()}"
    )

    print(
        f"Places: {df['place_id'].nunique()}"
    )

    print(
        "Target distribution:"
    )

    print(
        y.value_counts()
        .sort_index()
    )

    X_train, X_test, y_train, y_test = (
        train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
        )
    )

    print(
        f"Training rows: "
        f"{len(X_train)}"
    )

    print(
        f"Testing rows: "
        f"{len(X_test)}"
    )

    pipeline = build_pipeline()

    print(
        "Training metadata-enhanced "
        "Random Forest model..."
    )

    pipeline.fit(
        X_train,
        y_train,
    )

    predictions = pipeline.predict(
        X_test
    )

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
        "model_version": "v2",
        "model": "RandomForestRegressor",
        "dataset_rows": int(len(df)),
        "users": int(
            df["user_id"].nunique()
        ),
        "places": int(
            df["place_id"].nunique()
        ),
        "training_rows": int(
            len(X_train)
        ),
        "testing_rows": int(
            len(X_test)
        ),
        "features": FEATURE_COLUMNS,
        "n_estimators": 300,
        "random_state": 42,
        "metrics": {
            "mae": round(
                float(mae),
                4,
            ),
            "rmse": round(
                float(rmse),
                4,
            ),
        },
        "warning": (
            "This is an initial development "
            "dataset with limited users and "
            "interaction records. Results should "
            "not be treated as final "
            "generalisation performance."
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
    print(
        "Training v2 complete."
    )

    print(
        f"MAE: {mae:.4f}"
    )

    print(
        f"RMSE: {rmse:.4f}"
    )

    print(
        f"Model saved: {MODEL_FILE}"
    )

    print(
        f"Metrics saved: {METRICS_FILE}"
    )


if __name__ == "__main__":
    main()