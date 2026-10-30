export type BudgetAlertStatus =
  | "WITHIN_BUDGET"
  | "NEAR_BUDGET"
  | "OVER_BUDGET"
  | "NO_BUDGET_SET"
  | "ESTIMATE_INCOMPLETE";

export interface CostRange {
  min: number;
  max: number;
}

export interface EstimatedCostRange {
  min: number | null;
  max: number | null;
  complete: boolean;
  unknownItemCount: number;
}

export interface BudgetAlertItem {
  itineraryItemId: number;
  placeId: number;
  placeName: string;
  timeSlot: "Morning" | "Afternoon" | "Evening";
  order: number;
  priceLevel: number | null;
  estimatedCost: { min: number | null; max: number | null };
  reason: "PRICE_LEVEL_UNAVAILABLE" | "UNSUPPORTED_PRICE_LEVEL" | null;
}

export interface BudgetAlertDay {
  day: number;
  estimatedCost: EstimatedCostRange;
  knownEstimatedCost: CostRange;
  items: BudgetAlertItem[];
}

export interface BudgetAlertResult {
  status: BudgetAlertStatus;
  reason: "NO_BUDGET_SET" | "PRICE_DATA_INCOMPLETE" | null;
  currency: "MYR";
  budget: string | null;
  estimatedCost: EstimatedCostRange;
  knownEstimatedCost: CostRange;
  days: BudgetAlertDay[];
}
