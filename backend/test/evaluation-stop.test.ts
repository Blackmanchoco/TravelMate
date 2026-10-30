import { describe, expect, it } from "vitest";
import { safeEvaluationStop } from "../ai/evaluation/safe-evaluation-stop.mjs";

describe("safe evaluator stop reporting", () => {
  it("preserves lowercase generated case ID and a safe explicit reason", () => {
    expect(safeEvaluationStop(Object.assign(new Error("EVALUATION_STOP_hotel_bare_n_days_1"), { reason: "Fixed reply mismatch" })))
      .toEqual({ caseId: "hotel_bare_n_days", iteration: 1, reason: "Fixed reply mismatch" });
  });
  it("withholds arbitrary exception text and unsafe injected reason", () => {
    expect(safeEvaluationStop(new Error("connection configuration omitted"))).toBe("SETUP_OR_RUNTIME_ERROR_WITHHELD");
    expect(safeEvaluationStop(Object.assign(new Error("EVALUATION_STOP_hotel_1"), { reason: "sensitive text omitted" })))
      .toEqual({ caseId: "hotel", iteration: 1, reason: "Response or tool usage did not satisfy the fixed acceptance assertion" });
  });
});
