import type { Request, Response } from "express";

import { AppError } from "../../core/errors/app-error.js";
import { sendSuccess } from "../../core/http/api-response.js";

import {
  getUserById,
  getUserPreferences,
  updateUserPreferences,
  updateUserProfile,
} from "./users.service.js";

export async function getMe(req: Request, res: Response) {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError(
      "Authentication required.",
      401,
      "UNAUTHORIZED",
    );
  }

  const user = await getUserById(userId);

  if (!user) {
    throw new AppError(
      "User not found.",
      404,
      "USER_NOT_FOUND",
    );
  }

  return sendSuccess(res, {
    statusCode: 200,
    data: user,
    message: "User retrieved successfully.",
  });
}

export async function updateMe(
  req: Request,
  res: Response,
) {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError(
      "Authentication required.",
      401,
      "UNAUTHORIZED",
    );
  }

  const body = req.body ?? {};
  const allowedFields = new Set(["name", "avatar"]);
  const unsupportedField = Object.keys(body).find(
    (field) => !allowedFields.has(field),
  );

  if (unsupportedField) {
    throw new AppError(
      `Unsupported profile field: ${unsupportedField}.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  const { name, avatar } = body;

  if (name !== undefined && typeof name !== "string") {
    throw new AppError(
      "Name must be a string.",
      400,
      "VALIDATION_ERROR",
    );
  }

  if (avatar !== undefined && avatar !== null && typeof avatar !== "string") {
    throw new AppError(
      "Avatar must be a string or null.",
      400,
      "VALIDATION_ERROR",
    );
  }

  if (typeof name === "string" && !name.trim()) {
    throw new AppError(
      "Name cannot be empty.",
      400,
      "VALIDATION_ERROR",
    );
  }

  const user = await updateUserProfile({
    userId,
    name,
    avatar,
  });

  return sendSuccess(res, {
    statusCode: 200,
    data: user,
    message: "Profile updated successfully.",
  });
}

export async function getPreferences(
  req: Request,
  res: Response,
) {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError(
      "Authentication required.",
      401,
      "UNAUTHORIZED",
    );
  }

  const preferences = await getUserPreferences(userId);

  return sendSuccess(res, {
    statusCode: 200,
    data: preferences,
    message: "Preferences retrieved successfully.",
  });
}

export async function updatePreferences(
  req: Request,
  res: Response,
) {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError(
      "Authentication required.",
      401,
      "UNAUTHORIZED",
    );
  }

  const body = req.body ?? {};

  const stringOrNullFields = [
    "budget",
    "travelStyle",
    "preferredTransportation",
    "tripDuration",
  ] as const;

  for (const field of stringOrNullFields) {
    const value = body[field];

    if (
      value !== undefined &&
      value !== null &&
      typeof value !== "string"
    ) {
      throw new AppError(
        `${field} must be a string or null.`,
        400,
        "VALIDATION_ERROR",
      );
    }
  }

  const arrayFields = [
    "interests",
    "preferredActivities",
    "dietaryPreferences",
  ] as const;

  for (const field of arrayFields) {
    const value = body[field];

    if (
      value !== undefined &&
      (!Array.isArray(value) ||
        value.some((item) => typeof item !== "string"))
    ) {
      throw new AppError(
        `${field} must be an array of strings.`,
        400,
        "VALIDATION_ERROR",
      );
    }
  }

  const preferences = await updateUserPreferences({
    userId,
    budget: body.budget,
    travelStyle: body.travelStyle,
    interests: body.interests,
    preferredActivities: body.preferredActivities,
    dietaryPreferences: body.dietaryPreferences,
    preferredTransportation: body.preferredTransportation,
    tripDuration: body.tripDuration,
  });

  return sendSuccess(res, {
    statusCode: 200,
    data: preferences,
    message: "Preferences updated successfully.",
  });
}
