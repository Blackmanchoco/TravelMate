import { apiRequest } from "../lib/api-client";
import type { PreferenceMatchResult } from "../types/preference-match";

export function getPreferenceMatch(itineraryId: number, signal?: AbortSignal) {
  return apiRequest<PreferenceMatchResult>(`/itineraries/${itineraryId}/preference-match`, {
    auth: true,
    signal,
  });
}
