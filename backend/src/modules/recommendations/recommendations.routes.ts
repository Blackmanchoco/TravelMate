import { Router } from "express";

import { asyncHandler } from "../../core/http/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { listRecommendations } from "./recommendations.controller.js";

export const recommendationsRoutes = Router();

recommendationsRoutes.use(requireAuth);
recommendationsRoutes.get("/", asyncHandler(listRecommendations));
