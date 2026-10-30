import { describe, expect, it } from "vitest";
import { calculateBudgetAlert } from "../src/modules/itineraries/budget-alert.calculation.js";

const budget = (amount: number) => ({
  toFixed: (digits: number) => amount.toFixed(digits),
  valueOf: () => String(amount),
});
const item = (id: number, priceLevel: number | null) => ({
  id, day: 1, timeSlot: "Morning" as const, order: id,
  place: { id, name: `Place ${id}`, priceLevel },
});

describe("calculateBudgetAlert", () => {
  it("keeps a complete estimate within budget at its upper bound", () => {
    const result = calculateBudgetAlert(budget(70), [item(1, 2)]);
    expect(result.status).toBe("WITHIN_BUDGET");
    expect(result.estimatedCost).toEqual({ min: 30, max: 70, complete: true, unknownItemCount: 0 });
  });
  it("marks a budget between the minimum and maximum as near", () => {
    expect(calculateBudgetAlert(budget(50), [item(1, 2)]).status).toBe("NEAR_BUDGET");
  });
  it("marks a budget below the minimum as over", () => {
    expect(calculateBudgetAlert(budget(29), [item(1, 2)]).status).toBe("OVER_BUDGET");
  });
  it("uses the level-four 150–300 estimate at its budget boundaries", () => {
    const within = calculateBudgetAlert(budget(300), [item(1, 4)]);
    expect(within.estimatedCost).toEqual({ min: 150, max: 300, complete: true, unknownItemCount: 0 });
    expect(within.status).toBe("WITHIN_BUDGET");
    expect(calculateBudgetAlert(budget(299), [item(1, 4)]).status).toBe("NEAR_BUDGET");
    expect(calculateBudgetAlert(budget(149), [item(1, 4)]).status).toBe("OVER_BUDGET");
  });
  it("reports missing price data without a complete total", () => {
    const result = calculateBudgetAlert(budget(100), [item(1, 2), item(2, null)]);
    expect(result.status).toBe("ESTIMATE_INCOMPLETE");
    expect(result.estimatedCost).toEqual({ min: null, max: null, complete: false, unknownItemCount: 1 });
    expect(result.knownEstimatedCost).toEqual({ min: 30, max: 70 });
  });
  it("reports an unset budget even when prices are known", () => {
    const result = calculateBudgetAlert(null, [item(1, 2)]);
    expect(result.status).toBe("NO_BUDGET_SET");
    expect(result.budget).toBeNull();
  });
});
