import dotenv from "dotenv";

dotenv.config();

const DEFAULT_PORT = 5000;
const DEFAULT_CORS_ORIGIN = "http://localhost:5173";
const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/travelmate?schema=public";

  const DEFAULT_JWT_EXPIRES_IN = "7d";

function parseRequiredSecret(
  value: string | undefined,
  name: string,
): string {
  const secret = value?.trim();

  if (!secret) {
    throw new Error(`${name} is required.`);
  }

  return secret;
}

function parseJwtExpiresIn(value: string | undefined): string {
  return value?.trim() || DEFAULT_JWT_EXPIRES_IN;
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number(value);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error("PORT must be a positive integer.");
  }

  return parsedPort;
}

function parseCorsOrigins(value: string | undefined): string[] {
  const origins = value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins && origins.length > 0 ? origins : [DEFAULT_CORS_ORIGIN];
}

function parseDatabaseUrl(value: string | undefined): string {
  return value?.trim() || DEFAULT_DATABASE_URL;
}

function parseOptionalString(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function parsePositiveMilliseconds(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parsePort(process.env.PORT),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  databaseUrl: parseDatabaseUrl(process.env.DATABASE_URL),
  pythonExecutable: parseOptionalString(process.env.PYTHON_EXECUTABLE),
  recommenderTimeoutMs: parsePositiveMilliseconds(
    process.env.RECOMMENDER_TIMEOUT_MS,
    20_000,
    "RECOMMENDER_TIMEOUT_MS",
  ),
  ollamaBaseUrl: (process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434")
    .replace(/\/$/, ""),
  ollamaModel: process.env.OLLAMA_MODEL?.trim() || "qwen3:8b",
  ollamaTimeoutMs: parsePositiveMilliseconds(
    process.env.OLLAMA_TIMEOUT_MS,
    120_000,
    "OLLAMA_TIMEOUT_MS",
  ),
  weatherApiKey: parseOptionalString(process.env.WEATHER_API_KEY),

  jwtSecret: parseRequiredSecret(
    process.env.JWT_SECRET,
    "JWT_SECRET",
  ),
  jwtExpiresIn: parseJwtExpiresIn(process.env.JWT_EXPIRES_IN),
};

export const isProduction = env.nodeEnv === "production";
