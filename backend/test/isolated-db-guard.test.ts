import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { allowedDatabaseName } from "./db/guard.js";

function unreachableDatabaseUrl(name: string, query = "") {
  const url = new URL("postgresql:" + "//127.0.0.1:1/");
  url.pathname = `/${name}`;
  url.search = query;
  return url.toString();
}

describe("isolated database guard", () => {
  it("accepts only a complete dated restore name", () => {
    expect(allowedDatabaseName(unreachableDatabaseUrl("travelmate_c4_restore_20261004")))
      .toBe("travelmate_c4_restore_20261004");
    expect(() => allowedDatabaseName(unreachableDatabaseUrl("travelmate_c4_restore_20261004_extra")))
      .toThrow("Database name is not allowlisted");
    expect(() => allowedDatabaseName(unreachableDatabaseUrl("travelmate_c4_restore_20261004", "?dbname=travelmate")))
      .toThrow("Database URL override parameters are not allowed");
    expect(allowedDatabaseName(unreachableDatabaseUrl("travelmate_c4_restore_20261004", "?schema=public")))
      .toBe("travelmate_c4_restore_20261004");
  });
  it("rejects a main database name before trying an unreachable address", () => {
    const child = spawnSync(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"), "test/db/entry.ts", "--guard-only"], {
      cwd: resolve("."),
      env: { ...process.env, DATABASE_URL: unreachableDatabaseUrl("travelmate") },
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(child.status).not.toBe(0);
    expect(child.stderr).toContain("Database name is not allowlisted");
    expect(child.stderr).not.toContain("ECONNREFUSED");
    expect(child.stderr).not.toContain("postgresql:" + "//");
  });
});
