import { Router } from "express";

import { asyncHandler } from "../../core/http/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { chatWithAI, checkAIHealth } from "./ai.controller.js";

export const aiRoutes = Router();

aiRoutes.use(requireAuth);
aiRoutes.get("/health", asyncHandler(checkAIHealth));
aiRoutes.post("/chat", asyncHandler(chatWithAI));
