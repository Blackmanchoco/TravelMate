import type { Request, Response } from "express";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

import type { AppError } from "../src/core/errors/app-error.js";
import { buildErrorResponse } from "../src/core/http/api-response.js";

const mocks = vi.hoisted(() => ({ loginUser: vi.fn(), registerUser: vi.fn() }));

vi.mock("../src/modules/auth/auth.service.js", () => ({
  loginUser: mocks.loginUser,
  registerUser: mocks.registerUser,
}));

type AuthController = (req: Request, res: Response) => Promise<unknown>;
type TestResponse = {
  statusCode: number;
  headers: Map<string, string>;
  body?: unknown;
  status(code: number): TestResponse;
  setHeader(name: string, value: string): TestResponse;
  json(body: unknown): TestResponse;
};

let login: AuthController;
let register: AuthController;
let unthrottledLogin: AuthController;
let createAuthError: (message: string, statusCode: number, code: string) => Error;

function response(): TestResponse {
  return {
    statusCode: 200,
    headers: new Map(),
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers.set(name.toLowerCase(), value); return this; },
    json(body) { this.body = body; return this; },
  };
}

function request(email: string, ip: string): Request {
  return { body: { email, password: "wrong-password" }, ip, socket: { remoteAddress: ip } } as unknown as Request;
}

async function invoke(controller: AuthController, req: Request) {
  const res = response();
  try {
    await controller(req, res as unknown as Response);
  } catch (error) {
    const appError = error as AppError;
    res.status(appError.statusCode).json(buildErrorResponse(appError.message, appError.code));
  }
  return res;
}

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("AUTH_LOGIN_MAX_FAILURES", "10");
  vi.stubEnv("AUTH_LOGIN_WINDOW_MS", "600000");
  vi.stubEnv("AUTH_REGISTER_MAX_REQUESTS", "2");
  vi.stubEnv("AUTH_REGISTER_WINDOW_MS", "600000");
  vi.stubEnv("AUTH_RATE_LIMITS_ENABLED", "false");
  ({ login: unthrottledLogin } = await import("../src/modules/auth/auth.controller.js"));

  vi.stubEnv("AUTH_RATE_LIMITS_ENABLED", "true");
  vi.resetModules();
  const [{ login: enabledLogin, register: enabledRegister }, { AppError: errorClass }] = await Promise.all([
    import("../src/modules/auth/auth.controller.js"),
    import("../src/core/errors/app-error.js"),
  ]);
  login = enabledLogin;
  register = enabledRegister;
  createAuthError = (message, statusCode, code) => new errorClass(message, statusCode, code);
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loginUser.mockRejectedValue(createAuthError("Invalid email or password.", 401, "INVALID_CREDENTIALS"));
  mocks.registerUser.mockResolvedValue({});
});

afterAll(() => vi.unstubAllEnvs());

describe("auth request throttling", () => {
  it("keeps limits disabled by default in the test environment", async () => {
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const result = await invoke(unthrottledLogin, request("disabled@example.test", "192.0.2.1"));
      expect(result.statusCode).toBe(401);
    }
  });

  it("returns 429 with Retry-After after ten failures and isolates by email", async () => {
    const email = "locked@example.test";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await invoke(login, request(email, "192.0.2.2"))).statusCode).toBe(401);
    }
    const locked = await invoke(login, request(email, "192.0.2.2"));
    expect(locked.statusCode).toBe(429);
    expect(Number(locked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(locked.body).toMatchObject({ success: false, error: { code: "RATE_LIMITED" } });

    expect((await invoke(login, request("other@example.test", "192.0.2.2"))).statusCode).toBe(401);
  });

  it("resets failures after a successful login", async () => {
    const email = "reset@example.test";
    for (let attempt = 0; attempt < 9; attempt += 1) {
      expect((await invoke(login, request(email, "192.0.2.3"))).statusCode).toBe(401);
    }
    mocks.loginUser.mockResolvedValueOnce({});
    expect((await invoke(login, request(email, "192.0.2.3"))).statusCode).toBe(200);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await invoke(login, request(email, "192.0.2.3"))).statusCode).toBe(401);
    }
    expect((await invoke(login, request(email, "192.0.2.3"))).statusCode).toBe(429);
  });

  it("applies the configurable registration limit per IP", async () => {
    const ip = "192.0.2.4";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect((await invoke(register, request(`new-${attempt}@example.test`, ip))).statusCode).toBe(201);
    }
    const limited = await invoke(register, request("new-2@example.test", ip));
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
