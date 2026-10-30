import bcrypt from "bcrypt";
import { UserRole } from "@prisma/client";
import jwt, { type SignOptions } from "jsonwebtoken";

import {prisma} from "../../lib/prisma.js";
import {env} from "../../config/env.js";
import {AppError} from "../../core/errors/app-error.js";
import { hashPassword, normalizeEmail, validateEmail, validatePassword } from "./auth-credentials.js";

type RegisterInput = {
    name: string;
    email: string;
    password: string;
}

const MAX_NAME_LENGTH = 100;

function generateToken(userId: string, role: UserRole): string {
  const options: SignOptions = {
    algorithm: "HS256",
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign(
    { sub: userId, role },
    env.jwtSecret,
    options,
  );
}

type LoginInput = {
  email: string;
  password: string;
};

export async function loginUser(input: LoginInput) {
  const email = normalizeEmail(input.email);
  const password = input.password;

  validateEmail(email);
  validatePassword(password);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(
      "Invalid email or password.",
      401,
      "INVALID_CREDENTIALS",
    );
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new AppError(
      "Invalid email or password.",
      401,
      "INVALID_CREDENTIALS",
    );
  }

  const token = generateToken(user.id, user.role);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    token,
  };
}

export async function registerUser(input: RegisterInput) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!name || name.length > MAX_NAME_LENGTH) {
    throw new AppError(
      "Name is required and must be at most 100 characters.",
      400,
      "VALIDATION_ERROR",
    );
  }

  validateEmail(email);
  validatePassword(password);

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new AppError(
      "An account with this email already exists.",
      409,
      "EMAIL_ALREADY_EXISTS",
    );
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const token = generateToken(user.id, user.role);

  return {
    user,
    token,
  };
}
