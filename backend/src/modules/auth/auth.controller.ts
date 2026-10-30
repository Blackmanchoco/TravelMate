import type { Request, Response } from "express";

import { AppError } from "../../core/errors/app-error.js";
import { buildErrorResponse, sendSuccess } from "../../core/http/api-response.js";
import { authRateLimiter } from "./auth-rate-limit.js";
import { loginUser, registerUser } from "./auth.service.js";

function clientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function sendRateLimited(res: Response, retryAfterSeconds: number, message: string) {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  return res.status(429).json(buildErrorResponse(message, "RATE_LIMITED"));
}

export async function register(
  req: Request,
  res: Response,
) {
  const registrationLimit = authRateLimiter.consumeRegistration(clientIp(req));
  if (!registrationLimit.allowed) {
    return sendRateLimited(res, registrationLimit.retryAfterSeconds, "Too many registration requests. Try again later.");
  }

  const { name, email, password } = req.body ?? {};

  const result = await registerUser({
    name: typeof name === "string" ? name : "",
    email: typeof email === "string" ? email : "",
    password: typeof password === "string" ? password : "",
  });

  return sendSuccess(res, {
    statusCode: 201,
    data: result,
    message: "Registration successful.",
  });
}

export async function login(
  req: Request,
  res: Response,
) {
  const { email, password } = req.body ?? {};

  const ip = clientIp(req);
  const limit = authRateLimiter.beginLogin(ip, typeof email === "string" ? email : "");
  if (!limit.allowed) {
    return sendRateLimited(res, limit.retryAfterSeconds, "Too many login attempts. Try again later.");
  }

  try {
    const result = await loginUser({
      email: typeof email === "string" ? email : "",
      password: typeof password === "string" ? password : "",
    });
    authRateLimiter.finishLogin(ip, typeof email === "string" ? email : "", "success");

    return sendSuccess(res, {
      statusCode: 200,
      data: result,
      message: "Login successful.",
    });
  } catch (error) {
    const outcome = error instanceof AppError && error.statusCode === 401 ? "failure" : "neutral";
    authRateLimiter.finishLogin(ip, typeof email === "string" ? email : "", outcome);
    throw error;
  }
}
