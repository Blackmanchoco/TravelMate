import { Router } from "express";

import { asyncHandler } from "../../core/http/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";

import {
  getMe,
  updateMe,
  getPreferences,
  updatePreferences,
} from "./users.controller.js";

export const usersRoutes = Router();

usersRoutes.get(
  "/me",
  requireAuth,
  asyncHandler(getMe),
);

usersRoutes.patch(
  "/me",
  requireAuth,
  asyncHandler(updateMe),
);

usersRoutes.get(
  "/me/preferences",
  requireAuth,
  asyncHandler(getPreferences),
);

usersRoutes.put(
  "/me/preferences",
  requireAuth,
  asyncHandler(updatePreferences),
);