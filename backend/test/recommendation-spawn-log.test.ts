import { afterEach, expect, it, vi } from "vitest";

vi.mock("../src/config/env.js", () => ({
  env: { pythonExecutable: "__missing_python_for_recommendation_log_test__", recommenderTimeoutMs: 1_000 },
}));

import { getRecommendations } from "../src/modules/recommendations/recommendations.service.js";

afterEach(() => vi.restoreAllMocks());

it("records a spawn failure without user or database details", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await expect(getRecommendations({ userId: "private-user", destinationId: 1, limit: 5 }))
    .rejects.toMatchObject({ code: "RECOMMENDER_UNAVAILABLE" });
  expect(spy).toHaveBeenCalledTimes(1);
  const entry = JSON.parse(String(spy.mock.calls[0]?.[0]));
  expect(entry).toMatchObject({
    event: "recommendation_failure",
    code: "RECOMMENDER_UNAVAILABLE",
    stage: "spawn",
    exitCode: null,
  });
  expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(entry)).not.toContain("private-user");
});
