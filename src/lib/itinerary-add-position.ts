export type AddTimeSlot = "Morning" | "Afternoon" | "Evening";

export type ScheduledPosition = { day: number; timeSlot: AddTimeSlot; order: number; occupied: boolean };

const slots: AddTimeSlot[] = ["Morning", "Afternoon", "Evening"];
const dayMs = 86_400_000;

export function allowedItineraryDays(startDate: string | null, endDate: string | null, existingDays: number[]) {
  const start = startDate ? Date.parse(startDate.slice(0, 10) + "T00:00:00Z") : NaN;
  const end = endDate ? Date.parse(endDate.slice(0, 10) + "T00:00:00Z") : NaN;
  const dated = Number.isFinite(start) && Number.isFinite(end) && end >= start;
  const count = dated
    ? Math.round((end - start) / dayMs) + 1
    : Math.max(3, ...existingDays.filter((day) => Number.isInteger(day) && day > 0));
  return Array.from({ length: Math.min(count, 3660) }, (_, index) => index + 1);
}

export function positionForChoice(items: Array<{ day: number; timeSlot: AddTimeSlot; order: number }>, day: number, timeSlot: AddTimeSlot): ScheduledPosition {
  const inSlot = items.filter((item) => item.day === day && item.timeSlot === timeSlot);
  return { day, timeSlot, order: Math.max(0, ...inSlot.map((item) => item.order)) + 1, occupied: inSlot.length > 0 };
}

export function suggestedPosition(items: Array<{ day: number; timeSlot: AddTimeSlot; order: number }>, days: number[], hint: AddTimeSlot | null): ScheduledPosition {
  for (const day of days) {
    for (const timeSlot of hint ? [hint] : slots) {
      const position = positionForChoice(items, day, timeSlot);
      if (!position.occupied) return position;
    }
  }
  return positionForChoice(items, days[0] ?? 1, hint ?? "Morning");
}
