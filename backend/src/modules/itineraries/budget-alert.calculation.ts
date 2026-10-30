type BudgetTimeSlot = "Morning" | "Afternoon" | "Evening";
type BudgetAmount = { toFixed(fractionDigits: number): string; valueOf(): string };

const PRICE_LEVEL_RANGES: Record<number, { min: number; max: number }> = {
  1: { min: 0, max: 30 },
  2: { min: 30, max: 70 },
  3: { min: 70, max: 150 },
  4: { min: 150, max: 300 },
};

type BudgetStatus =
  | "WITHIN_BUDGET"
  | "NEAR_BUDGET"
  | "OVER_BUDGET"
  | "NO_BUDGET_SET"
  | "ESTIMATE_INCOMPLETE";

type BudgetAlertItemInput = {
  id: number;
  day: number;
  timeSlot: BudgetTimeSlot;
  order: number;
  place: {
    id: number;
    name: string;
    priceLevel: number | null;
  };
};

type EstimatedItem = {
  itineraryItemId: number;
  placeId: number;
  placeName: string;
  timeSlot: BudgetTimeSlot;
  order: number;
  priceLevel: number | null;
  estimatedCost: { min: number | null; max: number | null };
  reason: "PRICE_LEVEL_UNAVAILABLE" | "UNSUPPORTED_PRICE_LEVEL" | null;
};

function estimateItem(item: BudgetAlertItemInput): EstimatedItem {
  if (item.place.priceLevel === null) {
    return {
      itineraryItemId: item.id,
      placeId: item.place.id,
      placeName: item.place.name,
      timeSlot: item.timeSlot,
      order: item.order,
      priceLevel: null,
      estimatedCost: { min: null, max: null },
      reason: "PRICE_LEVEL_UNAVAILABLE",
    };
  }

  const range = PRICE_LEVEL_RANGES[item.place.priceLevel];
  if (!range) {
    return {
      itineraryItemId: item.id,
      placeId: item.place.id,
      placeName: item.place.name,
      timeSlot: item.timeSlot,
      order: item.order,
      priceLevel: item.place.priceLevel,
      estimatedCost: { min: null, max: null },
      reason: "UNSUPPORTED_PRICE_LEVEL",
    };
  }

  return {
    itineraryItemId: item.id,
    placeId: item.place.id,
    placeName: item.place.name,
    timeSlot: item.timeSlot,
    order: item.order,
    priceLevel: item.place.priceLevel,
    estimatedCost: { ...range },
    reason: null,
  };
}

function summarize(items: EstimatedItem[]) {
  const knownEstimatedCost = items.reduce(
    (total, item) => ({
      min: total.min + (item.estimatedCost.min ?? 0),
      max: total.max + (item.estimatedCost.max ?? 0),
    }),
    { min: 0, max: 0 },
  );
  const unknownItemCount = items.filter((item) => item.reason !== null).length;
  const complete = unknownItemCount === 0;

  return {
    estimatedCost: {
      min: complete ? knownEstimatedCost.min : null,
      max: complete ? knownEstimatedCost.max : null,
      complete,
      unknownItemCount,
    },
    knownEstimatedCost,
  };
}

function determineStatus(
  budget: BudgetAmount | null,
  estimatedCost: { min: number | null; max: number | null; complete: boolean },
): { status: BudgetStatus; reason: "NO_BUDGET_SET" | "PRICE_DATA_INCOMPLETE" | null } {
  if (budget === null) {
    return { status: "NO_BUDGET_SET", reason: "NO_BUDGET_SET" };
  }
  if (!estimatedCost.complete) {
    return { status: "ESTIMATE_INCOMPLETE", reason: "PRICE_DATA_INCOMPLETE" };
  }

  const budgetAmount = Number(budget);
  const minimum = estimatedCost.min!;
  const maximum = estimatedCost.max!;

  if (maximum <= budgetAmount) return { status: "WITHIN_BUDGET", reason: null };
  if (minimum > budgetAmount) return { status: "OVER_BUDGET", reason: null };
  return { status: "NEAR_BUDGET", reason: null };
}

export function calculateBudgetAlert(
  budget: BudgetAmount | null,
  items: BudgetAlertItemInput[],
) {
  const itemsByDay = new Map<number, EstimatedItem[]>();

  for (const item of items) {
    const estimatedItem = estimateItem(item);
    const dayItems = itemsByDay.get(item.day) ?? [];
    dayItems.push(estimatedItem);
    itemsByDay.set(item.day, dayItems);
  }

  const days = [...itemsByDay.entries()]
    .sort(([left], [right]) => left - right)
    .map(([day, dayItems]) => ({
      day,
      ...summarize(dayItems),
      items: dayItems,
    }));

  const allEstimatedItems = days.flatMap((day) => day.items);
  const totals = summarize(allEstimatedItems);
  const comparison = determineStatus(budget, totals.estimatedCost);

  return {
    ...comparison,
    currency: "MYR" as const,
    budget: budget === null ? null : budget.toFixed(2),
    ...totals,
    days,
  };
}
