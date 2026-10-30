export type PreferenceMatchDimensionName = "interests" | "activities" | "travelStyle" | "budget";

export interface PreferenceMatchDimensionSummary {
  score: number | null;
  configuredWeight: number;
  effectiveWeight: number;
  active: boolean;
  reason: string | null;
}

export interface PreferenceMatchPlaceDimension {
  score: number | null;
  weightedScore: number | null;
  configuredWeight: number;
  effectiveWeight: number;
  matched: string[];
  unmatched: string[];
  reason: string | null;
}

export interface PreferenceMatchPlace {
  itineraryItemId: number;
  placeId: number;
  placeName: string;
  score: number;
  dimensions: Record<PreferenceMatchDimensionName, PreferenceMatchPlaceDimension>;
}

export interface PreferenceMatchBreakdown {
  aggregation: "ITEM_OCCURRENCE_AVERAGE";
  itemCount: number;
  weights: Record<PreferenceMatchDimensionName, number>;
  dimensions: Record<PreferenceMatchDimensionName, PreferenceMatchDimensionSummary>;
  places: PreferenceMatchPlace[];
}

export interface PreferenceMatchResult {
  score: number | null;
  reason: string | null;
  breakdown: PreferenceMatchBreakdown | null;
}
