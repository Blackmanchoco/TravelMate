export const AUTH_UNAUTHORIZED_EVENT = "travelmate:auth-unauthorized";
export const SESSION_CLEARED_EVENT = "travelmate:session-cleared";

export function notifyUnauthorized() {
  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
}

export function notifySessionCleared() {
  window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
}
