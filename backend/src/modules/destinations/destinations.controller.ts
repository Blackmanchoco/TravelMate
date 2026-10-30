import type { Request, Response } from "express";

import { AppError } from "../../core/errors/app-error.js";
import { sendSuccess } from "../../core/http/api-response.js";
import {
  getDestinationById,
  getDestinations,
} from "./destinations.service.js";

function parsePositiveInt(
  value: unknown,
  fallback: number,
) {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parseLimit(value: unknown) {
  const limit = parsePositiveInt(value, 10);

  return Math.min(limit, 100);
}

export async function listDestinations(
  req: Request,
  res: Response,
) {
  const search =
    typeof req.query.search === "string"
      ? req.query.search.trim()
      : undefined;

  const city =
    typeof req.query.city === "string"
      ? req.query.city.trim()
      : undefined;

  const state =
    typeof req.query.state === "string"
      ? req.query.state.trim()
      : undefined;

  const page = parsePositiveInt(req.query.page, 1);
  const limit = parseLimit(req.query.limit);

  const result = await getDestinations({
    search,
    city,
    state,
    page,
    limit,
  });

  return sendSuccess(res, {
    statusCode: 200,
    data: result,
    message: "Destinations retrieved successfully.",
  });
}

export async function getDestination(
  req: Request,
  res: Response,
) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(
      "Invalid destination ID.",
      400,
      "INVALID_DESTINATION_ID",
    );
  }

  const destination = await getDestinationById(id);

  if (!destination) {
    throw new AppError(
      "Destination not found.",
      404,
      "DESTINATION_NOT_FOUND",
    );
  }

  return sendSuccess(res, {
    statusCode: 200,
    data: destination,
    message: "Destination retrieved successfully.",
  });
}