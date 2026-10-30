import { notifyUnauthorized } from "../auth/auth-events";
import { getStoredAccessToken } from "../auth/auth-storage";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api").replace(/\/$/, "");

interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

interface ApiFailure {
  success: false;
  error: {
    message: string;
    code: string;
  };
}

interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth) {
    const token = getStoredAccessToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError("Unable to connect to the TravelMate server.", 0, "NETWORK_ERROR");
  }

  let payload: ApiSuccess<T> | ApiFailure | null = null;

  try {
    payload = (await response.json()) as ApiSuccess<T> | ApiFailure;
  } catch {
    // A non-JSON response is converted to the same predictable client error shape.
  }

  if (!response.ok) {
    const failure = payload && !payload.success ? payload : null;
    const error = new ApiError(
      failure?.error.message ?? "The request could not be completed.",
      response.status,
      failure?.error.code ?? "REQUEST_FAILED",
    );

    if (options.auth && response.status === 401) {
      notifyUnauthorized();
    }

    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!payload || !payload.success) {
    throw new ApiError("The server returned an unexpected response.", response.status, "INVALID_RESPONSE");
  }

  return payload.data;
}
