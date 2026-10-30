import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const service = vi.hoisted(() => ({ createItinerary: vi.fn(), updateItinerary: vi.fn() }));
vi.mock("../src/modules/itineraries/itineraries.service.js", () => service);

import { create, update } from "../src/modules/itineraries/itineraries.controller.js";

const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() }) as unknown as Response;
const request = (body: object) => ({ user: { id: "owner" }, params: { id: "27" }, body }) as unknown as Request;

beforeEach(() => {
  vi.clearAllMocks();
  service.createItinerary.mockResolvedValue({ id: 27 });
  service.updateItinerary.mockResolvedValue({ id: 27 });
});

describe("itinerary HTTP calendar dates", () => {
  it.each(["2026-02-30", "2026-13-01", "February 28, 2026", "2026-2-28"])(
    "rejects invalid startDate %s on create with 400", async (startDate) => {
      await expect(create(request({ title: "Trip", startDate }), response()))
        .rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
      expect(service.createItinerary).not.toHaveBeenCalled();
    },
  );

  it.each(["2026-02-30", "tomorrow", "2026-10-14T00:00:00Z"])(
    "rejects invalid endDate %s on update with 400", async (endDate) => {
      await expect(update(request({ endDate }), response()))
        .rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
      expect(service.updateItinerary).not.toHaveBeenCalled();
    },
  );

  it("accepts leap day and preserves date-only UTC parsing", async () => {
    await create(request({ title: "Trip", startDate: "2028-02-29", endDate: "2028-03-01" }), response());
    expect(service.createItinerary).toHaveBeenCalledWith("owner", expect.objectContaining({
      startDate: new Date("2028-02-29T00:00:00.000Z"),
      endDate: new Date("2028-03-01T00:00:00.000Z"),
    }));
  });
});
