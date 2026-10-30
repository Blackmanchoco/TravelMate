import type { Request, Response } from "express";
import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPlaces: vi.fn() }));

vi.mock("../src/modules/places/places.service.js", () => ({
  getPlaces: mocks.getPlaces,
  getPlaceById: vi.fn(),
  getPlacesByDestination: vi.fn(),
  getNearbyPlaces: vi.fn(),
  getPlaceCategories: vi.fn(),
}));

import { listPlaces } from "../src/modules/places/places.controllers.js";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", "unit-test-key-only");
  vi.stubEnv("DATABASE_URL", "postgresql://unit-test:unit-test@127.0.0.1:5432/travelmate_scratch_security_hardening?schema=public");
  const [{ app }, { createBuiltApp }] = await Promise.all([
    import("../src/app.js"),
    import("../../scripts/demo/built-app.mjs"),
  ]);
  const servingApp = createBuiltApp(app, projectRoot);
  mocks.getPlaces.mockResolvedValue({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
  server = servingApp.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Ephemeral test server failed to bind.");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  vi.unstubAllEnvs();
});

describe("security hardening HTTP behavior", () => {
  it("rejects NUL bytes in place search before reaching the service", async () => {
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;

    await expect(listPlaces({ query: { search: "place\u0000suffix" } } as unknown as Request, response))
      .rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(mocks.getPlaces).not.toHaveBeenCalled();
  });

  it("sets the approved headers on API and served frontend responses", async () => {
    const apiResponse = await fetch(`${baseUrl}/api/health`);
    const frontendResponse = await fetch(`${baseUrl}/`);

    for (const response of [apiResponse, frontendResponse]) {
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      expect(response.headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
      expect(response.headers.get("x-powered-by")).toBeNull();
      expect(response.headers.get("content-security-policy")).toBeNull();
      expect(response.headers.get("strict-transport-security")).toBeNull();
    }
    expect(apiResponse.status).toBe(200);
    expect(frontendResponse.status).toBe(200);
  });

  it("returns a generic 413 envelope for oversized JSON bodies", async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pad: "x".repeat(1024 * 1024) }),
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large." },
    });
  });
});
