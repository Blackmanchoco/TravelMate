import type { TimeSlot } from "@prisma/client";

const DAY_MS = 86_400_000;

function calendarDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function daysInDateSpan(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  return Math.round((calendarDay(end) - calendarDay(start)) / DAY_MS) + 1;
}

export function invalidScheduledDays(days: number[], start: Date | null, end: Date | null): number[] {
  const length = daysInDateSpan(start, end);
  if (length === null) return [];
  return [...new Set(days.filter((day) => day < 1 || day > length))].sort((a, b) => a - b);
}

export function nextOrderInSlot(
  items: Array<{ day: number; timeSlot: TimeSlot; order: number }>,
  day: number,
  timeSlot: TimeSlot,
) {
  return Math.max(0, ...items.filter((item) => item.day === day && item.timeSlot === timeSlot)
    .map((item) => item.order)) + 1;
}
