import type { Request, Response } from "express";

import { AppError } from "../../core/errors/app-error.js";
import { sendSuccess } from "../../core/http/api-response.js";
import { getRecommendations } from "./recommendations.service.js";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

function owner(request: Request) {
  if (!request.user) {
    throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  }
  return request.user.id;
}

function parseOptionalPositiveInt(value: unknown, field: string): number | null {
  if (value === undefined) return null;

  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
  }

  return parsed;
}

function parseLimit(value: unknown): number {
  if (value === undefined) return DEFAULT_LIMIT;

  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError("Invalid limit.", 400, "VALIDATION_ERROR");
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    throw new AppError("Invalid limit.", 400, "VALIDATION_ERROR");
  }

  return parsed;
}

export async function listRecommendations(request: Request, response: Response) {
  const result = await getRecommendations({
    userId: owner(request),
    destinationId: parseOptionalPositiveInt(
      request.query.destinationId,
      "destinationId",
    ),
    limit: parseLimit(request.query.limit),
  });

  return sendSuccess(response, {
    data: result,
    message: "Recommendations retrieved successfully.",
  });
}
