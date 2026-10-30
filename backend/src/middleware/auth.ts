import type { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { AppError } from "../core/errors/app-error.js";
import { prisma } from "../lib/prisma.js";

type JwtPayload = {
  sub?: string;
  role?: UserRole;
};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
      };
    }
  }
}

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    throw new AppError(
      "Authentication required.",
      401,
      "UNAUTHORIZED",
    );
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError(
      "Invalid authorization header.",
      401,
      "INVALID_TOKEN",
    );
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
    }) as JwtPayload;

    if (
      !decoded.sub ||
      (decoded.role !== undefined &&
        !Object.values(UserRole).includes(decoded.role))
    ) {
      throw new AppError(
        "Invalid token payload.",
        401,
        "INVALID_TOKEN",
      );
    }

    req.user = {
      id: decoded.sub,
      role: decoded.role ?? UserRole.user,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      "Invalid or expired token.",
      401,
      "INVALID_TOKEN",
    );
  }
}

export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    throw new AppError(
      "Authentication required.",
      401,
      "UNAUTHORIZED",
    );
  }

  if (req.user.role !== UserRole.admin) {
    throw new AppError(
      "Administrator access is required.",
      403,
      "ADMIN_REQUIRED",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { role: true },
  });

  if (!user || user.role !== UserRole.admin) {
    throw new AppError(
      "Administrator access is required.",
      403,
      "ADMIN_REQUIRED",
    );
  }

  next();
}
