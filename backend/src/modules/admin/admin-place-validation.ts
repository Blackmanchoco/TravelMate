import { AppError } from "../../core/errors/app-error.js";
import { ADMIN_VOCABULARY } from "./admin-vocabulary.js";

export const MALAYSIA_BOUNDS = {
  minLatitude: 0.8, maxLatitude: 7.5,
  minLongitude: 99.5, maxLongitude: 119.5,
} as const;

const CREATE_FIELDS = new Set([
  "destinationId", "name", "category", "description", "address", "latitude", "longitude",
  "priceLevel", "sourceUrl", "tags", "activityTypes", "travelStyleTags", "displayTags", "imageUrl",
]);
const MAX_NAME = 150;
const MAX_DESCRIPTION = 2000;
const MAX_ADDRESS = 500;
const MAX_DISPLAY_TAG = 64;
const MAX_DISPLAY_TAGS = 10;
const MAX_URL = 2048;

export const ADMIN_PLACE_LIMITS = {
  name: MAX_NAME,
  description: MAX_DESCRIPTION,
  address: MAX_ADDRESS,
  sourceUrl: MAX_URL,
  displayTag: MAX_DISPLAY_TAG,
  displayTags: MAX_DISPLAY_TAGS,
} as const;

function invalid(message: string): never {
  throw new AppError(message, 400, "VALIDATION_ERROR");
}

export function validSourceUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > MAX_URL || /\s/u.test(value)) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function withinMalaysia(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= MALAYSIA_BOUNDS.minLatitude && latitude <= MALAYSIA_BOUNDS.maxLatitude
    && longitude >= MALAYSIA_BOUNDS.minLongitude && longitude <= MALAYSIA_BOUNDS.maxLongitude;
}

export function normalizeDisplayTags(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) invalid("Invalid displayTags.");
  const normalized = value.map((item: string) => item.normalize("NFKC").toLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/gu, ""));
  if (normalized.some((item: string) => !item || Array.from(item).length > MAX_DISPLAY_TAG)) invalid("Invalid displayTags.");
  const unique = [...new Set(normalized)];
  if (unique.length > MAX_DISPLAY_TAGS) invalid("Too many displayTags.");
  return unique;
}

function requiredString(value: unknown, field: string, limit: number): string {
  if (typeof value !== "string") invalid(`Invalid ${field}.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > limit) invalid(`Invalid ${field}.`);
  return normalized;
}

function vocabulary(value: unknown, field: keyof typeof ADMIN_VOCABULARY): string[] {
  const allowed: readonly string[] = ADMIN_VOCABULARY[field];
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !allowed.includes(item))) {
    invalid(`Invalid ${field}.`);
  }
  return [...new Set(value as string[])];
}

export function parseCreatePlaceInput(body: unknown, discoverableCategories: string[]) {
  if (!body || typeof body !== "object" || Array.isArray(body)) invalid("Invalid request body.");
  const data = body as Record<string, unknown>;
  if (Object.keys(data).some((key) => !CREATE_FIELDS.has(key))) invalid("Unknown place field.");
  if (!Number.isInteger(data.destinationId) || (data.destinationId as number) < 1) invalid("Invalid destinationId.");
  const category = requiredString(data.category, "category", 100);
  if (category.toLowerCase() === "test" || !discoverableCategories.includes(category)) invalid("Invalid category.");
  if (typeof data.latitude !== "number" || typeof data.longitude !== "number" || !withinMalaysia(data.latitude, data.longitude)) invalid("Invalid coordinates.");
  if (!Number.isInteger(data.priceLevel) || (data.priceLevel as number) < 1 || (data.priceLevel as number) > 4) invalid("Invalid priceLevel.");
  if (!validSourceUrl(data.sourceUrl)) invalid("Invalid sourceUrl.");
  if (data.imageUrl !== undefined && !validSourceUrl(data.imageUrl)) invalid("Invalid imageUrl.");
  return {
    destinationId: data.destinationId as number,
    name: requiredString(data.name, "name", MAX_NAME),
    category,
    description: requiredString(data.description, "description", MAX_DESCRIPTION),
    address: requiredString(data.address, "address", MAX_ADDRESS),
    latitude: data.latitude,
    longitude: data.longitude,
    priceLevel: data.priceLevel as number,
    sourceUrl: data.sourceUrl,
    imageUrl: data.imageUrl as string | undefined,
    tags: vocabulary(data.tags, "tags"),
    activityTypes: vocabulary(data.activityTypes, "activityTypes"),
    travelStyleTags: vocabulary(data.travelStyleTags, "travelStyleTags"),
    displayTags: normalizeDisplayTags(data.displayTags),
  };
}

export type CreatePlaceInput = ReturnType<typeof parseCreatePlaceInput>;
