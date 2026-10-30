import { Prisma, TimeSlot } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../core/errors/app-error.js";
import { activePlaceWhere } from "../places/place-visibility.js";
import { daysInDateSpan, invalidScheduledDays, nextOrderInSlot } from "./itinerary-schedule.js";
const detail = { include: { destination: true, items: { orderBy: [{ day: "asc" }, { timeSlot: "asc" }, { order: "asc" }], include: { place: true } } } } satisfies Prisma.ItineraryFindFirstArgs;
export type ItineraryInput = { title?: string; destinationId?: number | null; startDate?: Date | null; endDate?: Date | null; budget?: Prisma.Decimal | null; status?: string };
export type ItineraryItemInput = { placeId?: number; day?: number; timeSlot?: TimeSlot; order?: number; notes?: string | null; estimatedDuration?: string | null };

function assertDayInSpan(day: number, start: Date | null, end: Date | null) {
  const length = daysInDateSpan(start, end);
  if (length !== null && (day < 1 || day > length)) {
    throw new AppError(`Day ${day} is outside the itinerary date span (Days 1–${length}). Extend the end date or choose a valid day.`, 400, "ITINERARY_DAY_OUT_OF_RANGE");
  }
}

function notFound() { return new AppError("Itinerary not found.", 404, "ITINERARY_NOT_FOUND"); }
async function assertOwnedItinerary(tx: Prisma.TransactionClient, userId: string, id: number) {
  const itinerary = await tx.itinerary.findFirst({
    where: { id, userId },
    select: { id: true, startDate: true, endDate: true },
  });
  if (!itinerary) throw notFound();
  return itinerary;
}
async function assertPlaceExists(tx: Prisma.TransactionClient, placeId: number) {
  if (!await tx.place.findFirst({ where: { id: placeId, ...activePlaceWhere }, select: { id: true } })) throw new AppError("Place not found.", 404, "PLACE_NOT_FOUND");
}
function mapItemConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError("Another itinerary item already uses this day, time slot, and order.", 409, "ITINERARY_ITEM_SCHEDULE_CONFLICT");
  throw error;
}
function isPositionConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
    && Array.isArray(error.meta?.target)
    && ["itineraryId", "day", "timeSlot", "order"].every((field) => (error.meta?.target as string[]).includes(field));
}

export async function listItineraries({ userId, page, limit }: { userId: string; page: number; limit: number }) {
  const skip = (page - 1) * limit;
  const where = { userId };
  const [items, total] = await Promise.all([
    prisma.itinerary.findMany({ where, orderBy: { updatedAt: "desc" }, skip, take: limit, include: { destination: true, _count: { select: { items: true } } } }),
    prisma.itinerary.count({ where }),
  ]);
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
export async function getItinerary(userId: string, id: number) { const x = await prisma.itinerary.findFirst({ where: { id, userId }, ...detail }); if (!x) throw notFound(); return x; }
export async function createItinerary(userId: string, data: Required<Pick<ItineraryInput, "title">> & ItineraryInput) {
  return prisma.$transaction(async (tx) => { if (data.destinationId) await assertDestinationExists(tx, data.destinationId); return tx.itinerary.create({ data: { userId, ...data }, ...detail }); });
}
async function assertDestinationExists(tx: Prisma.TransactionClient, destinationId: number) { if (!await tx.destination.findUnique({ where: { id: destinationId }, select: { id: true } })) throw new AppError("Destination not found.", 404, "DESTINATION_NOT_FOUND"); }
export async function updateItinerary(userId: string, id: number, data: ItineraryInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await assertOwnedItinerary(tx, userId, id);
    const startDate = data.startDate === undefined ? existing.startDate : data.startDate;
    const endDate = data.endDate === undefined ? existing.endDate : data.endDate;
    if (startDate && endDate && endDate < startDate) throw new AppError("endDate must not be before startDate.", 400, "VALIDATION_ERROR");
    const dateChanged = (data.startDate !== undefined && data.startDate?.getTime() !== existing.startDate?.getTime())
      || (data.endDate !== undefined && data.endDate?.getTime() !== existing.endDate?.getTime());
    if (dateChanged) {
      const items = await tx.itineraryItem.findMany({ where: { itineraryId: id }, select: { day: true } });
      const invalid = invalidScheduledDays(items.map((item) => item.day), startDate, endDate);
      if (invalid.length) throw new AppError(`The date range would leave scheduled items outside it on ${invalid.map((day) => `Day ${day}`).join(", ")}. Extend the end date or move those items first.`, 400, "ITINERARY_DATE_SPAN_CONFLICT");
    }
    if (data.destinationId) await assertDestinationExists(tx, data.destinationId);
    return tx.itinerary.update({ where: { id }, data, ...detail });
  });
}
export async function deleteItinerary(userId: string, id: number) { await prisma.$transaction(async (tx) => { await assertOwnedItinerary(tx, userId, id); await tx.itinerary.delete({ where: { id } }); }); }
export async function createItineraryItem(userId: string, itineraryId: number, data: ItineraryItemInput & { placeId: number; day: number; timeSlot: TimeSlot }) {
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const itinerary = await assertOwnedItinerary(tx, userId, itineraryId);
        assertDayInSpan(data.day, itinerary.startDate, itinerary.endDate);
        await assertPlaceExists(tx, data.placeId);
        const items = data.order === undefined ? await tx.itineraryItem.findMany({ where: { itineraryId, day: data.day, timeSlot: data.timeSlot }, select: { day: true, timeSlot: true, order: true } }) : [];
        const order = data.order ?? nextOrderInSlot(items, data.day, data.timeSlot);
        return tx.itineraryItem.create({ data: { itineraryId, ...data, order }, include: { place: true } });
      });
    } catch (error) {
      if (data.order === undefined && isPositionConflict(error)) {
        if (attempt < 3) continue;
        throw new AppError("Another stop was added to this slot at the same time. Please try again.", 409, "ITINERARY_ITEM_SCHEDULE_CONFLICT");
      }
      return mapItemConflict(error);
    }
  }
  throw new AppError("Could not add this stop. Please try again.", 409, "ITINERARY_ITEM_SCHEDULE_CONFLICT");
}
export async function updateItineraryItem(userId: string, itineraryId: number, itemId: number, data: ItineraryItemInput) {
  try { return await prisma.$transaction(async (tx) => { const itinerary = await assertOwnedItinerary(tx, userId, itineraryId); const item = await tx.itineraryItem.findFirst({ where: { id: itemId, itineraryId }, select: { id: true, day: true } }); if (!item) throw new AppError("Itinerary item not found.", 404, "ITINERARY_ITEM_NOT_FOUND"); if (data.day !== undefined) assertDayInSpan(data.day, itinerary.startDate, itinerary.endDate); if (data.placeId) await assertPlaceExists(tx, data.placeId); return tx.itineraryItem.update({ where: { id: itemId }, data, include: { place: true } }); }); } catch (error) { return mapItemConflict(error); }
}
export async function deleteItineraryItem(userId: string, itineraryId: number, itemId: number) { await prisma.$transaction(async (tx) => { await assertOwnedItinerary(tx, userId, itineraryId); const result = await tx.itineraryItem.deleteMany({ where: { id: itemId, itineraryId } }); if (!result.count) throw new AppError("Itinerary item not found.", 404, "ITINERARY_ITEM_NOT_FOUND"); }); }
