import { Router } from "express";

import { asyncHandler } from "../../core/http/async-handler.js";

import {
  getDestination,
  listDestinations,
} from "./destinations.controller.js";

export const destinationsRoutes = Router();

destinationsRoutes.get(
  "/",
  asyncHandler(listDestinations),
);

destinationsRoutes.get(
  "/:id",
  asyncHandler(getDestination),
);