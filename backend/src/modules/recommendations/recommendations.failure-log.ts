export type RecommendationFailureStage = "spawn" | "python_exit" | "timeout" | "db";

export function logRecommendationFailure(input: {
  code: string;
  stage: RecommendationFailureStage;
  durationMs: number;
  exitCode: number | null;
}) {
  console.error(JSON.stringify({
    event: "recommendation_failure",
    code: input.code,
    stage: input.stage,
    durationMs: input.durationMs,
    exitCode: input.exitCode,
  }));
}
