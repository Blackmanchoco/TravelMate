import { expect, it, vi } from "vitest";
vi.mock("../src/lib/prisma.js", () => ({ prisma: {
  place: { count: vi.fn().mockResolvedValue(0), groupBy: vi.fn().mockResolvedValue([]), findMany: vi.fn().mockResolvedValue([]) },
  destination: { findMany: vi.fn().mockResolvedValue([]) },
  savedPlace: { groupBy: vi.fn().mockResolvedValue([]) },
  itineraryItem: { groupBy: vi.fn().mockResolvedValue([]) },
  adminAuditLog: { groupBy: vi.fn().mockResolvedValue([{action:"PLACE_CREATED",_count:{_all:2}}]) },
} }));
import { getCatalogReport } from "../src/modules/admin/admin.service.js";
it("reports aggregate audit actions without exposing audit actors or metadata", async () => {
  const report = await getCatalogReport();
  expect(report).toHaveProperty("generatedAt", expect.any(String));
  expect(report).toHaveProperty("auditSummary", { total: 2, byAction: [{ action: "PLACE_CREATED", count: 2 }] });
  expect(JSON.stringify(report)).not.toMatch(/adminUserId|email|metadata/);
});
