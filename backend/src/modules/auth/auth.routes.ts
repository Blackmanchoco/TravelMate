import { Router } from "express";

import { asyncHandler } from "../../core/http/async-handler.js";
import { login, register } from "./auth.controller.js";

export const authRoutes = Router();

authRoutes.post(
  "/register",
  asyncHandler(register),
);

authRoutes.post(
  "/login",
  asyncHandler(login),
);