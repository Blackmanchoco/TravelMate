import type { RequestHandler } from "express";

import { sendSuccess } from "../../core/http/api-response.js";

export const getHealth: RequestHandler = (_req, res) => {
  return sendSuccess(res, {
    message: "Backend API is running",
  });
};
