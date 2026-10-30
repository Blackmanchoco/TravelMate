import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";

import { AppError } from "../core/errors/app-error.js";
import { buildErrorResponse } from "../core/http/api-response.js";
import { isProduction } from "../config/env.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    res.status(413).json(buildErrorResponse("Request body is too large.", "PAYLOAD_TOO_LARGE"));
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json(buildErrorResponse("A record with this value already exists.", "CONFLICT"));
      return;
    }

    if (error.code === "P2025") {
      res.status(404).json(buildErrorResponse("Requested record was not found.", "NOT_FOUND"));
      return;
    }
  }

  const isKnownError = error instanceof AppError;
  const statusCode = isKnownError ? error.statusCode : 500;
  const code = isKnownError ? error.code : "INTERNAL_SERVER_ERROR";
  const message = isKnownError ? error.message : "Something went wrong.";

  if (!isKnownError && !isProduction) {
    console.error(error);
  }

  res.status(statusCode).json(buildErrorResponse(message, code));
};
