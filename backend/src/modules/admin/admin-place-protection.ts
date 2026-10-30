const PROTECTED_PLACE_IDS = new Set([31, 66, 67, 68, 69, 70, 71]);

export function isProtectedPlace(place: { id: number; category: string }): boolean {
  return PROTECTED_PLACE_IDS.has(place.id) || place.category.toLowerCase() === "test";
}

export function isRestorablePlace(place: { id: number; category: string; deletedAt: Date | null }): boolean {
  return place.deletedAt !== null && !isProtectedPlace(place);
}

export function protectedPlaceError(place: { id: number; category: string }): { code: string; message: string } | null {
  if (!isProtectedPlace(place)) return null;
  if (place.category.toLowerCase() === "test") {
    return { code: "TEST_PLACE_RESTORE_FORBIDDEN", message: "Test places cannot be restored." };
  }
  return { code: "PROTECTED_PLACE", message: "This place is protected." };
}
