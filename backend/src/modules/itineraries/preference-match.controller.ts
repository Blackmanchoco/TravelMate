import type { Request, Response } from "express";

import { AppError } from "../../core/errors/app-error.js";
import { sendSuccess } from "../../core/http/api-response.js";
import { getPreferenceMatch } from "./preference-match.service.js";

function owner(request: Request) {
  if (!request.user) throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  return request.user.id;
}

function itineraryId(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError("Invalid itinerary ID.", 400, "VALIDATION_ERROR");
  }
  return parsed;
}

export async function preferenceMatch(request: Request, response: Response) {
  return sendSuccess(response, {
    data: await getPreferenceMatch(owner(request), itineraryId(request.params.id)),
  });
}
