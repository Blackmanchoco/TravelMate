import type { RequestHandler } from "express";

import { AppError } from "../core/errors/app-error.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found.`, 404, "ROUTE_NOT_FOUND"));
};
