import type { Request, Response } from "express";
import { AppError } from "../../core/errors/app-error.js";
import { sendSuccess } from "../../core/http/api-response.js";
import * as service from "./saved-places.service.js";
const owner = (r: Request) => { if (!r.user) throw new AppError("Authentication required.", 401, "UNAUTHORIZED"); return r.user.id; };
const id = (v: unknown) => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw new AppError("Invalid place ID.", 400, "VALIDATION_ERROR"); return n; };
function paginationValue(value: unknown, field: string, fallback: number) {
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
  return parsed;
}
export async function list(r: Request, s: Response) {
  const page = paginationValue(r.query.page, "page", 1);
  const limit = paginationValue(r.query.limit, "limit", 10);
  if (limit > 100) throw new AppError("Invalid limit.", 400, "VALIDATION_ERROR");
  return sendSuccess(s, { data: await service.listSavedPlaces({ userId: owner(r), page, limit }) });
}
export async function create(r: Request, s: Response) { return sendSuccess(s, { data: await service.savePlace(owner(r), id(r.body?.placeId)), statusCode: 200 }); }
export async function remove(r: Request, s: Response) { await service.removeSavedPlace(owner(r), id(r.params.placeId)); return s.status(204).send(); }
