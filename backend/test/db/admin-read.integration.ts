import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { Client } from "pg";
import { it } from "vitest";
import { allowedDatabaseName, assertIsolatedDatabase } from "./guard.js";

type ApiResponse = { success: boolean; data?: Record<string, any> };
type Snapshot = {
  placeTotal: number;
  discoverable: number;
  userTotal: number;
  temporaryUsers: number;
  auditTotal: number;
  protectedPlaces: unknown[];
  itineraries: unknown[];
  itineraryItems: unknown[];
};

async function snapshot(client: Client): Promise<Snapshot> {
  const counts = await client.query(`
    SELECT
      (SELECT count(*)::int FROM places) AS "placeTotal",
      (SELECT count(*)::int FROM places WHERE "deletedAt" IS NULL AND lower(category) <> 'test') AS discoverable,
      (SELECT count(*)::int FROM users) AS "userTotal",
      (SELECT count(*)::int FROM users WHERE starts_with(email, 'c1-test-')) AS "temporaryUsers",
      (SELECT count(*)::int FROM admin_audit_logs) AS "auditTotal"
  `);
  const protectedPlaces = await client.query(`
    SELECT id, name, category, "destinationId", "priceLevel", "deletedAt", tags,
           "activityTypes", "travelStyleTags"
    FROM places WHERE id = ANY($1::int[]) ORDER BY id
  `, [[31, 66, 67, 68, 69, 70, 71]]);
  const itineraries = await client.query(`
    SELECT id, "userId", title, "destinationId", budget, status, "startDate", "endDate"
    FROM itineraries WHERE id = ANY($1::int[]) ORDER BY id
  `, [[6, 9]]);
  const itineraryItems = await client.query(`
    SELECT id, "itineraryId", "placeId", day, "timeSlot", "order"
    FROM itinerary_items WHERE "itineraryId" = ANY($1::int[]) ORDER BY "itineraryId", id
  `, [[6, 9]]);
  return {
    ...counts.rows[0],
    protectedPlaces: protectedPlaces.rows,
    itineraries: itineraries.rows,
    itineraryItems: itineraryItems.rows,
  };
}

async function request(base: string, path: string, options: { method?: string; token?: string; body?: object } = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return { status: response.status, body: await response.json() as ApiResponse };
}

it("checks Admin read access and archive visibility through isolated HTTP", async () => {
  assert.equal(process.env.PORT, "5054");
  assert.equal(allowedDatabaseName(process.env.DATABASE_URL), "travelmate_c4_restore_20261005");
  await assertIsolatedDatabase();
  const { Client } = await import("pg");
  const { default: bcrypt } = await import("bcrypt");
  const { app } = await import("../../src/app.js");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let server: Server | undefined;
  const runPrefix = `c1-test-${randomUUID()}-`;
  let createdCount = 0;
  let deletedCount = 0;
  let initial: Snapshot | undefined;
  try {
    initial = await snapshot(client);
    assert.equal(initial.discoverable, 40);
    assert.equal(initial.placeTotal, 47);
    assert.equal(initial.temporaryUsers, 0);
    assert.deepEqual(initial.protectedPlaces.map((row: any) => row.id), [31, 66, 67, 68, 69, 70, 71]);
    assert.deepEqual(initial.itineraries.map((row: any) => row.id), [6, 9]);
    assert.equal(initial.itineraryItems.length, 6);

    server = await new Promise<Server>((resolve, reject) => {
      const listener = app.listen(5054, "127.0.0.1", () => resolve(listener));
      listener.on("error", reject);
    });
    const base = "http://127.0.0.1:5054";
    const createAccount = async (kind: string) => {
      const id = randomUUID();
      const email = `${runPrefix}${randomUUID()}@example.invalid`;
      const secret = randomBytes(24).toString("base64url");
      const digest = await bcrypt.hash(secret, 12);
      const inserted = await client.query(`
        INSERT INTO users (id, name, email, "passwordHash", role, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, 'user', now(), now()) RETURNING id
      `, [id, `C1 ${kind}`, email, digest]);
      assert.equal(inserted.rowCount, 1);
      createdCount++;
      return { email, secret, id };
    };
    const ordinary = await createAccount("ordinary");
    const administrator = await createAccount("administrator");

    const ordinaryLogin = await request(base, "/api/auth/login", {
      method: "POST",
      body: { email: ordinary.email, password: ordinary.secret },
    });
    assert.equal(ordinaryLogin.status, 200);
    const ordinaryToken = ordinaryLogin.body.data?.token as string;

    const promotion = await client.query(`
      UPDATE users SET role = 'admin'
      WHERE id = $1 AND starts_with(email, 'c1-test-') AND role = 'user'
      RETURNING id
    `, [administrator.id]);
    assert.equal(promotion.rowCount, 1);
    const login = await request(base, "/api/auth/login", {
      method: "POST",
      body: { email: administrator.email, password: administrator.secret },
    });
    assert.equal(login.status, 200);
    const adminToken = login.body.data?.token as string;

    const noToken = await request(base, "/api/admin/stats");
    const ordinaryStats = await request(base, "/api/admin/stats", { token: ordinaryToken });
    const adminStats = await request(base, "/api/admin/stats", { token: adminToken });
    assert.deepEqual([noToken.status, ordinaryStats.status, adminStats.status], [401, 403, 200]);

    const ordinaryArchive = await request(base, "/api/admin/places?status=archived&limit=100", { token: ordinaryToken });
    const publicPlaces = await request(base, "/api/places?limit=100", { token: ordinaryToken });
    const adminArchive = await request(base, "/api/admin/places?status=archived&limit=100", { token: adminToken });
    const noOptions = await request(base, "/api/admin/places/options");
    const userOptions = await request(base, "/api/admin/places/options", { token: ordinaryToken });
    const adminOptions = await request(base, "/api/admin/places/options?displayTags=City%20Walk%2CNight__Market", { token: adminToken });
    assert.deepEqual([noOptions.status, userOptions.status, adminOptions.status], [401, 403, 200]);
    assert.equal(adminOptions.body.data?.destinations?.length, 6);
    assert.deepEqual(adminOptions.body.data?.categories, ["Attraction", "Culture", "Historical", "Nature", "Restaurant", "Shopping"]);
    assert.deepEqual(adminOptions.body.data?.vocabulary?.tags, ["culture", "food", "nature"]);
    assert.deepEqual(adminOptions.body.data?.displayTagsPreview, ["city-walk", "night-market"]);
    assert.deepEqual(adminOptions.body.data?.bounds, { minLatitude: 0.8, maxLatitude: 7.5, minLongitude: 99.5, maxLongitude: 119.5 });
    const withTest = await request(base, "/api/admin/places?status=all&includeTest=true&limit=100", { token: adminToken });
    assert.equal(withTest.status, 200);
    assert.equal(withTest.body.data?.items?.find((item: any) => item.id === 31)?.restorable, false);
    assert.equal(withTest.body.data?.items?.find((item: any) => item.id === 31)?.restoreDisabledReason, "Test places cannot be restored.");
    assert.equal(ordinaryArchive.status, 403);
    assert.equal(publicPlaces.status, 200);
    assert.equal(adminArchive.status, 200);
    assert.equal(publicPlaces.body.data?.pagination?.total, 40);
    assert.equal(publicPlaces.body.data?.items?.length, 40);
    assert.equal(adminArchive.body.data?.pagination?.total, 6);
    assert.deepEqual(
      [...adminArchive.body.data!.items.map((item: any) => item.id)].sort((a, b) => a - b),
      [66, 67, 68, 69, 70, 71],
    );
    assert.ok(adminArchive.body.data!.items.every((item: any) => item.restorable === false && item.restoreDisabledReason === "This place is protected."));
    assert.equal(publicPlaces.body.data!.items.some((item: any) => [31, 66, 67, 68, 69, 70, 71].includes(item.id)), false);

    const demotion = await client.query(`
      UPDATE users SET role = 'user'
      WHERE id = $1 AND starts_with(email, 'c1-test-') AND role = 'admin'
      RETURNING id
    `, [administrator.id]);
    assert.equal(demotion.rowCount, 1);
    const oldTokenAfterDemotion = await request(base, "/api/admin/stats", { token: adminToken });
    assert.equal(oldTokenAfterDemotion.status, 403);

    console.log("C1 Admin HTTP: no token 401, user 403, admin 200, demoted old token 403; archive user 403, public 40, admin archived 6");
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    const deleted = await client.query(`
      DELETE FROM users WHERE starts_with(email, $1) RETURNING id
    `, [runPrefix]);
    deletedCount = deleted.rowCount ?? 0;
    const final = await snapshot(client);
    await client.end();
    assert.equal(deletedCount, createdCount);
    assert.equal(final.temporaryUsers, 0);
    if (initial) assert.deepEqual(final, initial);
    console.log(`C1 isolated cleanup: created ${createdCount}, deleted ${deletedCount}; snapshots equal`);
  }
}, 60_000);
