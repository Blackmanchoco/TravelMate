import { Router } from "express";

import { asyncHandler } from "../../core/http/async-handler.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import * as controller from "./admin.controller.js";

export const adminRoutes = Router();

adminRoutes.use(requireAuth);
adminRoutes.use(asyncHandler(requireAdmin));

adminRoutes.get("/stats", asyncHandler(controller.stats));
adminRoutes.get("/reports/catalog", asyncHandler(controller.catalogReport));
adminRoutes.get("/users", asyncHandler(controller.users));
adminRoutes.get("/places/options", asyncHandler(controller.placeOptions));
adminRoutes.get("/places", asyncHandler(controller.places));
adminRoutes.post("/places", asyncHandler(controller.createPlace));
adminRoutes.post("/places/:placeId/restore", asyncHandler(controller.restoreArchivedPlace));
adminRoutes.get("/itineraries", asyncHandler(controller.itineraries));
adminRoutes.delete("/places/:placeId", asyncHandler(controller.removePlace));
adminRoutes.delete(
  "/itineraries/:itineraryId",
  asyncHandler(controller.removeItinerary),
);
