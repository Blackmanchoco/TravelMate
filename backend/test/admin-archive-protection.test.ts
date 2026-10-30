import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const tx = {
    place: { findUnique: vi.fn(), updateMany: vi.fn() },
    adminAuditLog: { create: vi.fn() },
  };
  return { tx, transaction: vi.fn(async (work: (client: typeof tx) => unknown) => work(tx)) };
});
vi.mock("../src/lib/prisma.js", () => ({ prisma: { $transaction: db.transaction } }));

import { archivePlace, restorePlace } from "../src/modules/admin/admin.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  db.tx.place.updateMany.mockResolvedValue({ count: 1 });
  db.tx.adminAuditLog.create.mockResolvedValue({ id: 1 });
  db.tx.place.findUnique.mockResolvedValue({
    id: 31, name: "Protected fixture", category: "Test", destinationId: 1,
    deletedAt: null, _count: { savedBy: 0, itineraryItems: 0 },
  });
});

describe("protected Admin Place mutations", () => {
  it.each([
    [31, "Test", "TEST_PLACE_RESTORE_FORBIDDEN"],
    [66, "Attraction", "PROTECTED_PLACE"],
  ])("rejects archiving protected place %i with the restore protection code", async (id, category, code) => {
    db.tx.place.findUnique.mockResolvedValueOnce({
      id, name: "Protected fixture", category, destinationId: 1,
      deletedAt: null, _count: { savedBy: 0, itineraryItems: 0 },
    });
    await expect(archivePlace("admin", id)).rejects.toMatchObject({ statusCode: 403, code });
    expect(db.tx.place.updateMany).not.toHaveBeenCalled();
    expect(db.tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("restore continues to reject the protected Test fixture", async () => {
    await expect(restorePlace("admin", 31)).rejects.toMatchObject({
      statusCode: 403, code: "TEST_PLACE_RESTORE_FORBIDDEN",
    });
  });
});
