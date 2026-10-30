import type { ItineraryItem } from "../../types/itinerary";
import type { CostRange } from "../../types/budget-alert";

const slotOrder: Record<ItineraryItem["timeSlot"], number> = {
  Morning: 0, Afternoon: 1, Evening: 2,
};

export function groupPrintDays(items: ItineraryItem[]) {
  const sorted = [...items].sort((left, right) =>
    left.day - right.day || slotOrder[left.timeSlot] - slotOrder[right.timeSlot] ||
    left.order - right.order || left.id - right.id);
  const groups = new Map<number, ItineraryItem[]>();
  for (const item of sorted) groups.set(item.day, [...(groups.get(item.day) ?? []), item]);
  return [...groups].map(([day, dayItems]) => ({ day, items: dayItems }));
}

export function formatEstimatedCost(range: CostRange, complete: boolean) {
  const money = (value: number) => value.toLocaleString("en-MY", { maximumFractionDigits: 2 });
  const amount = range.min === range.max ? `RM ${money(range.min)}` : `RM ${money(range.min)}–${money(range.max)}`;
  return `${complete ? "Estimated cost" : "Estimated known costs only"}: ${amount}`;
}
