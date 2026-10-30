import type { Request, Response } from "express";
import { TimeSlot } from "@prisma/client";
import { AppError } from "../../core/errors/app-error.js";
import { sendSuccess } from "../../core/http/api-response.js";
import * as service from "./itineraries.service.js";
const owner = (r: Request) => { if (!r.user) throw new AppError("Authentication required.", 401, "UNAUTHORIZED"); return r.user.id; };
const id = (v: unknown, label = "itinerary ID") => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw new AppError(`Invalid ${label}.`, 400, "VALIDATION_ERROR"); return n; };
const date = (value: unknown, field: string) => {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
  }
  return parsed;
};
function paginationValue(value: unknown, field: string, fallback: number) {
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR");
  return parsed;
}
function itineraryPayload(body: Record<string, unknown>, creating: boolean) {
  const data: Record<string, unknown> = {};
  if (body.title !== undefined || creating) { const title = typeof body.title === "string" ? body.title.trim() : ""; if (!title || title.length > 150) throw new AppError("Title is required and must be at most 150 characters.", 400, "VALIDATION_ERROR"); data.title = title; }
  if (body.status !== undefined) { if (typeof body.status !== "string" || !body.status.trim() || body.status.length > 50) throw new AppError("Invalid status.", 400, "VALIDATION_ERROR"); data.status = body.status.trim(); }
  if (body.destinationId !== undefined) data.destinationId = body.destinationId === null ? null : id(body.destinationId, "destination ID");
  if (body.startDate !== undefined) data.startDate = date(body.startDate, "startDate");
  if (body.endDate !== undefined) data.endDate = date(body.endDate, "endDate");
  if (body.budget !== undefined) { if (body.budget === null) data.budget = null; else { const budget = Number(body.budget); if (!Number.isFinite(budget) || budget < 0) throw new AppError("Invalid budget.", 400, "VALIDATION_ERROR"); data.budget = budget; } }
  const start = data.startDate instanceof Date ? data.startDate : undefined; const end = data.endDate instanceof Date ? data.endDate : undefined; if (start && end && end < start) throw new AppError("endDate must not be before startDate.", 400, "VALIDATION_ERROR");
  if (!creating && Object.keys(data).length === 0) throw new AppError("At least one field is required.", 400, "VALIDATION_ERROR");
  return data;
}
function itemPayload(body: Record<string, unknown>, creating: boolean) {
  const data: Record<string, unknown> = {};
  for (const field of ["placeId", "day", "order"] as const) { if (body[field] !== undefined || (creating && field !== "order")) data[field] = id(body[field], field === "placeId" ? "place ID" : field); }
  if (body.timeSlot !== undefined || creating) { if (typeof body.timeSlot !== "string" || !Object.values(TimeSlot).includes(body.timeSlot as TimeSlot)) throw new AppError("Invalid timeSlot.", 400, "VALIDATION_ERROR"); data.timeSlot = body.timeSlot; }
  for (const field of ["notes", "estimatedDuration"] as const) if (body[field] !== undefined) { if (body[field] !== null && (typeof body[field] !== "string" || body[field].length > 1000)) throw new AppError(`Invalid ${field}.`, 400, "VALIDATION_ERROR"); data[field] = body[field]; }
  if (!creating && Object.keys(data).length === 0) throw new AppError("At least one item field is required.", 400, "VALIDATION_ERROR");
  return data;
}
export async function list(r: Request, s: Response) {
  const page = paginationValue(r.query.page, "page", 1);
  const limit = paginationValue(r.query.limit, "limit", 10);
  if (limit > 100) throw new AppError("Invalid limit.", 400, "VALIDATION_ERROR");
  return sendSuccess(s, { data: await service.listItineraries({ userId: owner(r), page, limit }) });
}
export async function get(r: Request, s: Response) { return sendSuccess(s, { data: await service.getItinerary(owner(r), id(r.params.id)) }); }
export async function create(r: Request, s: Response) { return sendSuccess(s, { statusCode: 201, data: await service.createItinerary(owner(r), itineraryPayload(r.body ?? {}, true) as Parameters<typeof service.createItinerary>[1]) }); }
export async function update(r: Request, s: Response) { return sendSuccess(s, { data: await service.updateItinerary(owner(r), id(r.params.id), itineraryPayload(r.body ?? {}, false)) }); }
export async function remove(r: Request, s: Response) { await service.deleteItinerary(owner(r), id(r.params.id)); return s.status(204).send(); }
export async function createItem(r: Request, s: Response) { return sendSuccess(s, { statusCode: 201, data: await service.createItineraryItem(owner(r), id(r.params.id), itemPayload(r.body ?? {}, true) as Parameters<typeof service.createItineraryItem>[2]) }); }
export async function updateItem(r: Request, s: Response) { return sendSuccess(s, { data: await service.updateItineraryItem(owner(r), id(r.params.id), id(r.params.itemId, "item ID"), itemPayload(r.body ?? {}, false)) }); }
export async function removeItem(r: Request, s: Response) { await service.deleteItineraryItem(owner(r), id(r.params.id), id(r.params.itemId, "item ID")); return s.status(204).send(); }
