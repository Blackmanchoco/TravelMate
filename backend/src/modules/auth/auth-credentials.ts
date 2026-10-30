import bcrypt from "bcrypt";

import { AppError } from "../../core/errors/app-error.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_BYTES = 72;

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function validateEmail(email: string): void {
  if (!email) {
    throw new AppError("Email is required.", 400, "VALIDATION_ERROR");
  }
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new AppError("Email must be valid.", 400, "VALIDATION_ERROR");
  }
}

export function validatePassword(password: string): void {
  if (!password) {
    throw new AppError("Password is required.", 400, "VALIDATION_ERROR");
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw new AppError(
      "Password must be at least 8 characters and no more than 72 UTF-8 bytes.",
      400,
      "VALIDATION_ERROR",
    );
  }
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
