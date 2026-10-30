import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "../../config/env.js";
import { AppError } from "../../core/errors/app-error.js";
import { logRecommendationFailure, type RecommendationFailureStage } from "./recommendations.failure-log.js";
import type {
  RecommendationItem,
  RecommendationResult,
  RunnerResponse,
} from "./recommendations.types.js";

const MAX_STDOUT_BYTES = 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;
const BACKEND_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const RUNNER_PATH = path.join(
  BACKEND_ROOT,
  "ai",
  "recommendation",
  "recommendation_runner.py",
);

function pythonExecutable() {
  if (env.pythonExecutable) {
    return env.pythonExecutable;
  }

  return process.platform === "win32"
    ? path.join(BACKEND_ROOT, ".venv", "Scripts", "python.exe")
    : path.join(BACKEND_ROOT, ".venv", "bin", "python");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSkipCounts(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((count) => Number.isInteger(count) && Number(count) >= 0);
}

function isRecommendationItem(value: unknown): value is RecommendationItem {
  if (!isRecord(value)) return false;

  return Number.isInteger(value.rank)
    && Number.isInteger(value.placeId)
    && typeof value.placeName === "string"
    && Number.isInteger(value.destinationId)
    && typeof value.destinationName === "string"
    && typeof value.category === "string"
    && (value.rating === null
      || (typeof value.rating === "number" && Number.isFinite(value.rating)))
    && Number.isInteger(value.priceLevel)
    && typeof value.mlRankScore === "number"
    && Number.isFinite(value.mlRankScore)
    && typeof value.finalScore === "number"
    && Number.isFinite(value.finalScore)
    && Array.isArray(value.reason)
    && value.reason.every((reason) => typeof reason === "string");
}

function parseRunnerResponse(output: string): RunnerResponse {
  let value: unknown;

  try {
    value = JSON.parse(output);
  } catch {
    throw new AppError(
      "The recommendation service returned an invalid response.",
      503,
      "RECOMMENDER_INVALID_RESPONSE",
    );
  }

  if (!isRecord(value) || typeof value.ok !== "boolean") {
    throw new AppError(
      "The recommendation service returned an invalid response.",
      503,
      "RECOMMENDER_INVALID_RESPONSE",
    );
  }

  if (value.ok === false) {
    if (!isRecord(value.error)
      || typeof value.error.code !== "string"
      || typeof value.error.message !== "string") {
      throw new AppError(
        "The recommendation service returned an invalid response.",
        503,
        "RECOMMENDER_INVALID_RESPONSE",
      );
    }

    return {
      ok: false,
      error: {
        code: value.error.code,
        message: value.error.message,
      },
    };
  }

  if (typeof value.modelVersion !== "string"
    || typeof value.algorithm !== "string"
    || !Array.isArray(value.items)
    || !value.items.every(isRecommendationItem)
    || !isSkipCounts(value.skippedCandidates)) {
    throw new AppError(
      "The recommendation service returned an invalid response.",
      503,
      "RECOMMENDER_INVALID_RESPONSE",
    );
  }

  return {
    ok: true,
    modelVersion: value.modelVersion,
    algorithm: value.algorithm,
    items: value.items,
    skippedCandidates: value.skippedCandidates,
  };
}

function runPython(input: {
  userId: string;
  limit: number;
  destinationId: number | null;
}): Promise<RunnerResponse> {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(pythonExecutable(), [RUNNER_PATH], {
        cwd: BACKEND_ROOT,
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
        },
      });
    } catch {
      const error = new AppError("The recommendation service is unavailable.", 503, "RECOMMENDER_UNAVAILABLE");
      logRecommendationFailure({ code: error.code, stage: "spawn", durationMs: Math.round(performance.now() - startedAt), exitCode: null });
      reject(error);
      return;
    }

    let stdout = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };

    const fail = (error: AppError, stage: RecommendationFailureStage, exitCode: number | null = null, logCode = error.code) => {
      finish(() => {
        logRecommendationFailure({
          code: logCode,
          stage,
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
          exitCode,
        });
        reject(error);
      });
    };

    const timeout = setTimeout(() => {
      child.kill();
      fail(new AppError(
        "The recommendation service timed out.",
        503,
        "RECOMMENDER_TIMEOUT",
      ), "timeout");
    }, env.recommenderTimeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdoutBytes += Buffer.byteLength(chunk);
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        child.kill();
        fail(new AppError(
          "The recommendation service returned an invalid response.",
          503,
          "RECOMMENDER_INVALID_RESPONSE",
        ), "python_exit");
        return;
      }
      stdout += chunk;
    });

    child.stderr.on("data", (chunk: string) => {
      stderrBytes += Buffer.byteLength(chunk);
      if (stderrBytes > MAX_STDERR_BYTES) {
        child.kill();
        fail(new AppError(
          "The recommendation service returned an invalid response.",
          503,
          "RECOMMENDER_INVALID_RESPONSE",
        ), "python_exit");
      }
    });

    child.on("error", () => {
      fail(new AppError(
        "The recommendation service is unavailable.",
        503,
        "RECOMMENDER_UNAVAILABLE",
      ), "spawn");
    });

    child.stdin.on("error", () => {
      fail(new AppError(
        "The recommendation service is unavailable.",
        503,
        "RECOMMENDER_UNAVAILABLE",
      ), "spawn");
    });

    child.on("close", (exitCode) => {
      if (settled) return;

      let response: RunnerResponse;
      try {
        response = parseRunnerResponse(stdout.trim());
      } catch (error) {
        fail(error instanceof AppError ? error : new AppError(
          "The recommendation service returned an invalid response.", 503, "RECOMMENDER_INVALID_RESPONSE",
        ), "python_exit", exitCode);
        return;
      }

      if (!response.ok) {
        if (response.error.code === "NO_PREFERENCE_SET") {
          fail(new AppError(
            response.error.message,
            422,
            "NO_PREFERENCE_SET",
          ), "python_exit", exitCode);
          return;
        }
        fail(new AppError(
          "The recommendation service is unavailable.",
          503,
          "RECOMMENDER_UNAVAILABLE",
        ), response.error.code === "RECOMMENDER_DB_ERROR" ? "db" : "python_exit", exitCode,
        response.error.code === "RECOMMENDER_DB_ERROR" ? "RECOMMENDER_DB_ERROR" : "RECOMMENDER_UNAVAILABLE");
        return;
      }

      if (exitCode !== 0) {
        fail(new AppError(
          "The recommendation service is unavailable.",
          503,
          "RECOMMENDER_UNAVAILABLE",
        ), "python_exit", exitCode);
        return;
      }

      finish(() => resolve(response));
    });

    child.stdin.end(JSON.stringify(input));
  });
}

export async function getRecommendations(input: {
  userId: string;
  limit: number;
  destinationId: number | null;
}): Promise<RecommendationResult> {
  const result = await runPython(input);

  if (!result.ok) {
    throw new AppError(
      "The recommendation service is unavailable.",
      503,
      "RECOMMENDER_UNAVAILABLE",
    );
  }

  return {
    items: result.items,
    meta: {
      modelVersion: result.modelVersion,
      algorithm: result.algorithm,
      destinationId: input.destinationId,
      limit: input.limit,
      skippedCandidates: result.skippedCandidates,
    },
  };
}
