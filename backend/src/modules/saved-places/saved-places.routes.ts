import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import * as c from "./saved-places.controller.js";
export const savedPlacesRoutes = Router();
savedPlacesRoutes.use(requireAuth);
savedPlacesRoutes.get("/", asyncHandler(c.list)); savedPlacesRoutes.post("/", asyncHandler(c.create)); savedPlacesRoutes.delete("/:placeId", asyncHandler(c.remove));
