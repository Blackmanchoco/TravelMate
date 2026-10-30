import { beforeEach, describe, expect, it, vi } from "vitest";

const records = vi.hoisted(() => ({ rows: [] as Array<{ id: number; category: string; deletedAt: Date | null }> }));
vi.mock("../src/lib/prisma.js", () => ({ prisma: { place: {
  findUnique: vi.fn(async ({ where }: { where: { id: number; deletedAt?: null } }) =>
    records.rows.find(row => row.id === where.id && (where.deletedAt === undefined || row.deletedAt === null)) ?? null),
} } }));
import { getPlaceById } from "../src/modules/places/places.service.js";

describe("public place detail archive visibility", () => {
  beforeEach(() => {
    records.rows = [
      { id: 1, category: "Attraction", deletedAt: null },
      { id: 2, category: "Attraction", deletedAt: new Date("2026-10-18T00:00:00Z") },
      { id: 31, category: "Test", deletedAt: null },
      { id: 32, category: "Test", deletedAt: new Date("2026-10-18T00:00:00Z") },
    ];
  });
  it("hides archived catalogue detail", async () => { expect(await getPlaceById(2)).toBeNull(); });
  it("also hides an archived internal fixture from public detail", async () => { expect(await getPlaceById(32)).toBeNull(); });
  it("keeps active catalogue detail", async () => { expect((await getPlaceById(1))?.id).toBe(1); });
  it("preserves the explicit active Test-fixture direct-read rule", async () => { expect((await getPlaceById(31))?.id).toBe(31); });
  it("keeps unknown detail absent", async () => { expect(await getPlaceById(999)).toBeNull(); });
});
