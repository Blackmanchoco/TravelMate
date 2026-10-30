import { afterEach, expect, it, vi } from "vitest";
import { logRecommendationFailure } from "../src/modules/recommendations/recommendations.failure-log.js";

afterEach(() => vi.restoreAllMocks());

it("logs only a fixed failure code, stage, elapsed time and exit code", () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  logRecommendationFailure({
    code: "RECOMMENDER_TIMEOUT",
    stage: "timeout",
    durationMs: 20000,
    exitCode: null,
    userId: "private-user",
    databaseUrl: "private-connection",
  } as Parameters<typeof logRecommendationFailure>[0]);
  const text = spy.mock.calls.map((call) => call.join(" ")).join("\n");
  expect(JSON.parse(text)).toEqual({
    event: "recommendation_failure",
    code: "RECOMMENDER_TIMEOUT",
    stage: "timeout",
    durationMs: 20000,
    exitCode: null,
  });
  expect(text).not.toMatch(/private-user|private-connection/);
});
