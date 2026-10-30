import type { Request, Response } from "express";

import { AppError } from "../../core/errors/app-error.js";
import { sendSuccess } from "../../core/http/api-response.js";
import {
  getPlaceById,
  getPlacesByDestination,
  getNearbyPlaces,
  getPlaceCategories,
  getPlaces,
} from "./places.service.js";

const DEFAULT_NEARBY_RADIUS_KM = 5;
const DEFAULT_NEARBY_LIMIT = 10;
const MAX_LIMIT = 100;

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

function parsePaginationValue(
  value: unknown,
  field: string,
  fallback: number,
) {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string") {
    throw new AppError(
      `Invalid ${field}.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(
      `Invalid ${field}.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  return parsed;
}

function parseBoundedLimit(
  value: unknown,
  fallback: number,
) {
  const limit = parsePaginationValue(value, "limit", fallback);

  if (limit > MAX_LIMIT) {
    throw new AppError(
      "Invalid limit.",
      400,
      "VALIDATION_ERROR",
    );
  }

  return limit;
}

function parseOptionalPositiveInt(
  value: unknown,
  field: string,
) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError(
      `Invalid ${field}.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(
      `Invalid ${field}.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  return parsed;
}

function parseOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim() || undefined;
}

function parseSearch(value: unknown) {
  const search = parseOptionalString(value);
  if (search?.includes("\u0000")) {
    throw new AppError(
      "Search query must not contain null bytes.",
      400,
      "VALIDATION_ERROR",
    );
  }
  return search;
}

function parseMinRating(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError(
      "Invalid minimum rating.",
      400,
      "INVALID_MIN_RATING",
    );
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5) {
    throw new AppError(
      "Minimum rating must be between 0 and 5.",
      400,
      "INVALID_MIN_RATING",
    );
  }

  return parsed;
}

function parseCoordinate(
  value: unknown,
  field: "latitude" | "longitude",
) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(
      `Invalid ${field}.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  const parsed = Number(value);
  const minimum = field === "latitude" ? -90 : -180;
  const maximum = field === "latitude" ? 90 : 180;

  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new AppError(
      `Invalid ${field}.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  return parsed;
}

function parseRadiusKm(value: unknown) {
  if (value === undefined) {
    return DEFAULT_NEARBY_RADIUS_KM;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(
      "Invalid radiusKm.",
      400,
      "VALIDATION_ERROR",
    );
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError(
      "Invalid radiusKm.",
      400,
      "VALIDATION_ERROR",
    );
  }

  return parsed;
}

export async function listPlaces(
  req: Request,
  res: Response,
) {
  const page = parsePaginationValue(req.query.page, "page", 1);
  const limit = parseBoundedLimit(req.query.limit, 10);

  const result = await getPlaces({
    destinationId: parseOptionalPositiveInt(
      req.query.destinationId,
      "destinationId",
    ),
    city: parseOptionalString(req.query.city),
    category: parseOptionalString(req.query.category),
    search: parseSearch(req.query.search),
    minRating: parseMinRating(req.query.minRating),
    page,
    limit,
  });

  return sendSuccess(res, {
    statusCode: 200,
    data: result,
    message: "Places retrieved successfully.",
  });
}

export async function listPlaceCategories(
  req: Request,
  res: Response,
) {
  const categories = await getPlaceCategories(
    parseOptionalPositiveInt(
      req.query.destinationId,
      "destinationId",
    ),
  );

  return sendSuccess(res, {
    statusCode: 200,
    data: categories,
    message: "Place categories retrieved successfully.",
  });
}

export async function listNearbyPlaces(
  req: Request,
  res: Response,
) {
  const places = await getNearbyPlaces({
    latitude: parseCoordinate(req.query.latitude, "latitude"),
    longitude: parseCoordinate(req.query.longitude, "longitude"),
    radiusKm: parseRadiusKm(req.query.radiusKm),
    destinationId: parseOptionalPositiveInt(
      req.query.destinationId,
      "destinationId",
    ),
    category: parseOptionalString(req.query.category),
    limit: parseBoundedLimit(req.query.limit, DEFAULT_NEARBY_LIMIT),
  });

  return sendSuccess(res, {
    statusCode: 200,
    data: places,
    message: "Nearby places retrieved successfully.",
  });
}

export async function listPlacesByDestination(
  req: Request,
  res: Response,
) {
  const destinationId = Number(req.params.destinationId);

  if (!Number.isInteger(destinationId) || destinationId < 1) {
    throw new AppError(
      "Invalid destination ID.",
      400,
      "INVALID_DESTINATION_ID",
    );
  }

  const search =
    typeof req.query.search === "string"
      ? req.query.search.trim()
      : undefined;

  const category =
    typeof req.query.category === "string"
      ? req.query.category.trim()
      : undefined;

  let minRating: number | undefined;

  if (req.query.minRating !== undefined) {
    if (typeof req.query.minRating !== "string") {
      throw new AppError(
        "Invalid minimum rating.",
        400,
        "INVALID_MIN_RATING",
      );
    }

    const parsed = Number(req.query.minRating);

    if (
      !Number.isFinite(parsed) ||
      parsed < 0 ||
      parsed > 5
    ) {
      throw new AppError(
        "Minimum rating must be between 0 and 5.",
        400,
        "INVALID_MIN_RATING",
      );
    }

    minRating = parsed;
  }

  const page = parsePositiveInt(req.query.page, 1);
  const limit = parseLimit(req.query.limit);

  const result = await getPlacesByDestination({
    destinationId,
    search,
    category,
    minRating,
    page,
    limit,
  });

  return sendSuccess(res, {
    statusCode: 200,
    data: result,
    message: "Places retrieved successfully.",
  });
}

export async function getPlace(
  req: Request,
  res: Response,
) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(
      "Invalid place ID.",
      400,
      "INVALID_PLACE_ID",
    );
  }

  const place = await getPlaceById(id);

  if (!place) {
    throw new AppError(
      "Place not found.",
      404,
      "PLACE_NOT_FOUND",
    );
  }

  return sendSuccess(res, {
    statusCode: 200,
    data: place,
    message: "Place retrieved successfully.",
  });
}
