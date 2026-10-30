import type { AuthUser } from "../auth/auth.types";
import { apiRequest } from "../lib/api-client";
import type {
  UpdateCurrentUserInput,
  UpdateUserPreferenceInput,
  UserPreference,
} from "../types/user";

export function getCurrentUser(signal?: AbortSignal) {
  return apiRequest<AuthUser>("/users/me", { auth: true, signal });
}

export function updateCurrentUser(input: UpdateCurrentUserInput) {
  return apiRequest<AuthUser>("/users/me", {
    method: "PATCH",
    auth: true,
    body: input,
  });
}

export function getUserPreferences(signal?: AbortSignal) {
  return apiRequest<UserPreference | null>("/users/me/preferences", {
    auth: true,
    signal,
  });
}

export function updateUserPreferences(input: UpdateUserPreferenceInput) {
  return apiRequest<UserPreference>("/users/me/preferences", {
    method: "PUT",
    auth: true,
    body: input,
  });
}
