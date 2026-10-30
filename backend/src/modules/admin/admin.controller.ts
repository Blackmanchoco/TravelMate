import type { Request, Response } from "express";

import { AppError } from "../../core/errors/app-error.js";
import { sendSuccess } from "../../core/http/api-response.js";
import {
  archivePlace,
  createAdminPlace,
  deleteAdminItinerary,
  getAdminStats,
  getAdminPlaceOptions,
  getCatalogReport,
  listAdminItineraries,
  listAdminPlaces,
  listAdminUsers,
  restorePlace,
  type AdminPlaceStatus,
} from "./admin.service.js";

const MAX_LIMIT = 100;
const PLACE_STATUSES = new Set<AdminPlaceStatus>([
  "active",
  "archived",
  "all",
]);

function paginationValue(
  value: unknown,
  field: "page" | "limit",
  fallback: number,
) {
  if (value === undefined) return fallback;
  if (typeof value !== "string") {
    throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
  }
  if (field === "limit" && parsed > MAX_LIMIT) {
    throw new AppError("Invalid limit.", 400, "VALIDATION_ERROR");
  }
  return parsed;
}

function optionalString(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function optionalPositiveInt(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
  }
  return parsed;
}

function optionalBoolean(value: unknown, field: string) {
  if (value === undefined) return false;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
}

function requestPagination(req: Request) {
  return {
    page: paginationValue(req.query.page, "page", 1),
    limit: paginationValue(req.query.limit, "limit", 10),
  };
}

function positiveId(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
  }
  return parsed;
}

function adminId(req: Request) {
  if (!req.user) {
    throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  }
  return req.user.id;
}

export async function stats(_req: Request, res: Response) {
  return sendSuccess(res, {
    data: await getAdminStats(),
    message: "Admin statistics retrieved successfully.",
  });
}

export async function catalogReport(_req: Request, res: Response) {
  return sendSuccess(res, {
    data: await getCatalogReport(),
    message: "Catalog report retrieved successfully.",
  });
}

export async function users(req: Request, res: Response) {
  return sendSuccess(res, {
    data: await listAdminUsers({
      ...requestPagination(req),
      search: optionalString(req.query.search, "search"),
    }),
    message: "Users retrieved successfully.",
  });
}

export async function places(req: Request, res: Response) {
  const rawStatus = optionalString(req.query.status, "status") ?? "active";
  if (!PLACE_STATUSES.has(rawStatus as AdminPlaceStatus)) {
    throw new AppError("Invalid status.", 400, "VALIDATION_ERROR");
  }

  return sendSuccess(res, {
    data: await listAdminPlaces({
      ...requestPagination(req),
      search: optionalString(req.query.search, "search"),
      category: optionalString(req.query.category, "category"),
      destinationId: optionalPositiveInt(
        req.query.destinationId,
        "destinationId",
      ),
      status: rawStatus as AdminPlaceStatus,
      includeTest: optionalBoolean(req.query.includeTest, "includeTest"),
    }),
    message: "Places retrieved successfully.",
  });
}

export async function placeOptions(req: Request, res: Response) {
  return sendSuccess(res, {
    data: await getAdminPlaceOptions(optionalString(req.query.displayTags, "displayTags")),
    message: "Admin place options retrieved successfully.",
  });
}

export async function itineraries(req: Request, res: Response) {
  return sendSuccess(res, {
    data: await listAdminItineraries({
      ...requestPagination(req),
      search: optionalString(req.query.search, "search"),
      userId: optionalString(req.query.userId, "userId"),
      status: optionalString(req.query.status, "status"),
    }),
    message: "Itineraries retrieved successfully.",
  });
}

export async function removePlace(req: Request, res: Response) {
  return sendSuccess(res, {
    data: await archivePlace(
      adminId(req),
      positiveId(req.params.placeId, "place ID"),
    ),
    message: "Place archived successfully.",
  });
}

export async function createPlace(req: Request, res: Response) {
  return sendSuccess(res, {
    statusCode: 201,
    data: await createAdminPlace(adminId(req), req.body),
    message: "Place created successfully.",
  });
}

export async function restoreArchivedPlace(req: Request, res: Response) {
  return sendSuccess(res, {
    data: await restorePlace(adminId(req), positiveId(req.params.placeId, "place ID")),
    message: "Place restored successfully.",
  });
}

export async function removeItinerary(req: Request, res: Response) {
  return sendSuccess(res, {
    data: await deleteAdminItinerary(
      adminId(req),
      positiveId(req.params.itineraryId, "itinerary ID"),
    ),
    message: "Itinerary deleted successfully.",
  });
}
