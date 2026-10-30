import type { Response } from "express";

type SuccessResponse<T> = {
  success: true;
  data?: T;
  message?: string;
};

type ErrorResponse = {
  success: false;
  error: {
    message: string;
    code: string;
  };
};

export function sendSuccess<T>(
  res: Response,
  options: { statusCode?: number; data?: T; message?: string },
) {
  const response: SuccessResponse<T> = {
    success: true,
  };

  if (options.data !== undefined) {
    response.data = options.data;
  }

  if (options.message) {
    response.message = options.message;
  }

  return res.status(options.statusCode ?? 200).json(response);
}

export function buildErrorResponse(message: string, code: string): ErrorResponse {
  return {
    success: false,
    error: {
      message,
      code,
    },
  };
}
