import { apiRequest } from "../lib/api-client";
import type { BudgetAlertResult } from "../types/budget-alert";

export function getBudgetAlert(itineraryId: number, signal?: AbortSignal) {
  return apiRequest<BudgetAlertResult>(`/itineraries/${itineraryId}/budget-alert`, {
    auth: true,
    signal,
  });
}
