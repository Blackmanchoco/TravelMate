import type { Request, Response } from "express";

import { AppError } from "../../core/errors/app-error.js";
import { sendSuccess } from "../../core/http/api-response.js";
import { getItineraryWeather } from "./itinerary-weather.service.js";

export async function itineraryWeather(request: Request, response: Response) {
  if (!request.user) throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  const itineraryId = Number(request.params.id);
  if (!Number.isInteger(itineraryId) || itineraryId < 1) {
    throw new AppError("Invalid itinerary ID.", 400, "VALIDATION_ERROR");
  }
  return sendSuccess(response, {
    data: await getItineraryWeather(request.user.id, itineraryId),
  });
}
