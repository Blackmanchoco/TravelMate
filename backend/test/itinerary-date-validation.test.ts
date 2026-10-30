import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const db = vi.hoisted(() => {
  const itinerary = { id: 27, startDate: new Date("2026-10-14T00:00:00Z"), endDate: new Date("2026-10-14T00:00:00Z") };
  const tx = {
    itinerary: { findFirst: vi.fn(), update: vi.fn() },
    itineraryItem: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    place: { findFirst: vi.fn() },
  };
  return { itinerary, tx, transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) };
});
vi.mock("../src/lib/prisma.js", () => ({ prisma: { $transaction: db.transaction } }));

import { createItineraryItem, updateItinerary, updateItineraryItem } from "../src/modules/itineraries/itineraries.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  db.tx.itinerary.findFirst.mockResolvedValue(db.itinerary);
  db.tx.itineraryItem.findMany.mockResolvedValue([]);
  db.tx.itineraryItem.findFirst.mockResolvedValue({ id: 9, day: 1 });
  db.tx.place.findFirst.mockResolvedValue({ id: 3 });
  db.tx.itineraryItem.create.mockResolvedValue({ id: 100, day: 1, timeSlot: "Morning", order: 1 });
  db.tx.itineraryItem.update.mockResolvedValue({ id: 9, day: 1 });
  db.tx.itinerary.update.mockResolvedValue({ id: 27 });
});

describe("itinerary API date-span service", () => {
  it("rejects item creation beyond the inclusive one-day span", async () => {
    await expect(createItineraryItem("owner", 27, { placeId: 3, day: 2, timeSlot: "Morning" }))
      .rejects.toMatchObject({ code: "ITINERARY_DAY_OUT_OF_RANGE", statusCode: 400 });
    expect(db.tx.itineraryItem.create).not.toHaveBeenCalled();
  });

  it("appends at max order plus one in an occupied slot", async () => {
    db.tx.itineraryItem.findMany.mockResolvedValue([
      { day: 1, timeSlot: "Morning", order: 1 }, { day: 1, timeSlot: "Morning", order: 3 },
    ]);
    await createItineraryItem("owner", 27, { placeId: 3, day: 1, timeSlot: "Morning" });
    expect(db.tx.itineraryItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ day: 1, timeSlot: "Morning", order: 4 }),
    }));
  });

  it("re-reads the slot and retries at the next position after a concurrent add", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("position taken", {
      code: "P2002", clientVersion: "test", meta: { target: ["itineraryId", "day", "timeSlot", "order"] },
    });
    db.tx.itineraryItem.findMany
      .mockResolvedValueOnce([{ day: 1, timeSlot: "Morning", order: 1 }])
      .mockResolvedValueOnce([{ day: 1, timeSlot: "Morning", order: 1 }, { day: 1, timeSlot: "Morning", order: 2 }]);
    db.tx.itineraryItem.create.mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce({ id: 101, day: 1, timeSlot: "Morning", order: 3 });

    const result = await createItineraryItem("owner", 27, { placeId: 3, day: 1, timeSlot: "Morning" });

    expect(result.order).toBe(3);
    expect(db.transaction).toHaveBeenCalledTimes(2);
    expect(db.tx.itineraryItem.create.mock.calls.map(([call]) => call.data.order)).toEqual([2, 3]);
  });

  it("returns a clear 409 after three position retries", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("position taken", {
      code: "P2002", clientVersion: "test", meta: { target: ["itineraryId", "day", "timeSlot", "order"] },
    });
    db.tx.itineraryItem.create.mockRejectedValue(conflict);

    await expect(createItineraryItem("owner", 27, { placeId: 3, day: 1, timeSlot: "Morning" }))
      .rejects.toMatchObject({ statusCode: 409, code: "ITINERARY_ITEM_SCHEDULE_CONFLICT",
        message: expect.stringContaining("Please try again") });
    expect(db.transaction).toHaveBeenCalledTimes(4);
  });

  it("rejects an item day update beyond the span", async () => {
    await expect(updateItineraryItem("owner", 27, 9, { day: 3 }))
      .rejects.toMatchObject({ code: "ITINERARY_DAY_OUT_OF_RANGE", statusCode: 400 });
    expect(db.tx.itineraryItem.update).not.toHaveBeenCalled();
  });

  it("lists all days made invalid by a date edit", async () => {
    db.tx.itineraryItem.findMany.mockResolvedValue([{ day: 2 }, { day: 3 }, { day: 3 }]);
    await expect(updateItinerary("owner", 27, { endDate: new Date("2026-10-15T00:00:00Z") }))
      .rejects.toMatchObject({ code: "ITINERARY_DATE_SPAN_CONFLICT", message: expect.stringContaining("Day 3") });
  });

  it("allows an unrelated edit to a legacy out-of-range itinerary", async () => {
    await updateItinerary("owner", 27, { title: "Renamed" });
    expect(db.tx.itineraryItem.findMany).not.toHaveBeenCalled();
    expect(db.tx.itinerary.update).toHaveBeenCalled();
  });
});
