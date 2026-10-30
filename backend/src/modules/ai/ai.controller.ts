import type { Request, Response } from "express";

import { AppError } from "../../core/errors/app-error.js";
import { sendSuccess } from "../../core/http/api-response.js";
import { getAIHealth, sendAIChat } from "./ai.service.js";
import type { AIChatHistoryMessage } from "./ai.types.js";

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_LENGTH = 6_000;

function validationError(message: string): never {
  throw new AppError(message, 400, "VALIDATION_ERROR");
}

function parseHistory(value: unknown): AIChatHistoryMessage[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_HISTORY_MESSAGES || value.length % 2 !== 0) {
    return validationError("History must contain at most 3 complete user/assistant turns.");
  }

  let totalLength = 0;
  return value.map((entry: unknown, index: number) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)
      || Object.keys(entry).some((key) => key !== "role" && key !== "content")) {
      return validationError("History messages may contain only role and content.");
    }
    const candidate = entry as Record<string, unknown>;
    const expectedRole = index % 2 === 0 ? "user" : "assistant";
    if (candidate.role !== expectedRole || typeof candidate.content !== "string"
      || !candidate.content.trim() || candidate.content.length > MAX_MESSAGE_LENGTH) {
      return validationError("History must alternate nonempty user and assistant messages of at most 4000 characters.");
    }
    totalLength += candidate.content.length;
    if (totalLength > MAX_HISTORY_LENGTH) {
      return validationError("History must be 6000 characters or fewer in total.");
    }
    return { role: expectedRole, content: candidate.content };
  });
}

export async function checkAIHealth(_request: Request, response: Response) {
  const result = await getAIHealth();

  return sendSuccess(response, {
    data: result,
    message: "AI service is available.",
  });
}

export async function chatWithAI(request: Request, response: Response) {
  if (typeof request.body !== "object" || request.body === null
    || Array.isArray(request.body)
    || Object.keys(request.body).some((key) => key !== "message" && key !== "history")) {
    return validationError("Request may contain only message and history.");
  }
  const message = typeof request.body?.message === "string"
    ? request.body.message.trim()
    : "";

  if (!message) {
    throw new AppError("Message is required.", 400, "VALIDATION_ERROR");
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(
      `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  if (!request.user) {
    throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  }

  const history = parseHistory(request.body.history);
  const result = await sendAIChat(message, request.user.id, history);

  return sendSuccess(response, {
    data: result,
    message: "AI response generated successfully.",
  });
}
