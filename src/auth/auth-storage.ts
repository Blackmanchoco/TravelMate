import type { AuthSession, AuthUser } from "./auth.types";
import { notifySessionCleared } from "./auth-events";

export const ACCESS_TOKEN_STORAGE_KEY = "travelmate_access_token";
export const AUTH_USER_STORAGE_KEY = "travelmate_auth_user";

const USER_DATA_STORAGE_KEYS = [
  "travelmate-itinerary-v2",
  "travelmate-saved-places-v2",
  "travelmate-itinerary",
  "travelmate-saved-trips",
];
const LEGACY_AUTH_STORAGE_KEYS = [
  "travelmate_is_authenticated",
  "travelmate_user_name",
];

export function getStoredAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function getStoredAuthUser(): AuthUser | null {
  const storedUser = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    const user = JSON.parse(storedUser) as Partial<AuthUser>;

    if (
      typeof user.id !== "string" ||
      typeof user.name !== "string" ||
      typeof user.email !== "string" ||
      (user.role !== "user" && user.role !== "admin")
    ) {
      return null;
    }

    return user as AuthUser;
  } catch {
    return null;
  }
}

export function storeAuthSession(session: AuthSession) {
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, session.token);
  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(session.user));
  LEGACY_AUTH_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

export function storeAuthUser(user: AuthUser) {
  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  USER_DATA_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  LEGACY_AUTH_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  notifySessionCleared();
}
