import { Router } from "express";

import { asyncHandler } from "../../core/http/async-handler.js";

import {
  getPlace,
  listNearbyPlaces,
  listPlaceCategories,
  listPlaces,
  listPlacesByDestination,
} from "./places.controllers.js";

export const placesRoutes = Router();

placesRoutes.get(
  "/destination/:destinationId",
  asyncHandler(listPlacesByDestination),
);

placesRoutes.get(
  "/nearby",
  asyncHandler(listNearbyPlaces),
);

placesRoutes.get(
  "/categories",
  asyncHandler(listPlaceCategories),
);

placesRoutes.get(
  "/",
  asyncHandler(listPlaces),
);

placesRoutes.get(
  "/:id",
  asyncHandler(getPlace),
);
