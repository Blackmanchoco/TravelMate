import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { Client } from "pg";
import { it } from "vitest";
import { allowedDatabaseName, assertIsolatedDatabase } from "./guard.js";

type ResponseBody = { success: boolean; data?: any; error?: { code: string; message: string } };
async function request(base: string, path: string, options: { method?: string; token?: string; body?: object } = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return { status: response.status, body: await response.json() as ResponseBody };
}

async function snapshot(client: Client) {
  const counts = await client.query(`SELECT
    (SELECT count(*)::int FROM places) AS places,
    (SELECT count(*)::int FROM places WHERE "deletedAt" IS NULL AND lower(category) <> 'test') AS discoverable,
    (SELECT count(*)::int FROM users) AS users,
    (SELECT count(*)::int FROM users WHERE starts_with(email, 'c1-test-')) AS temporary_users,
    (SELECT count(*)::int FROM admin_audit_logs) AS audits`);
  const protectedRows = await client.query(`SELECT id, name, category, "destinationId", description, address,
    latitude, longitude, "priceLevel", tags, "activityTypes", "travelStyleTags", "deletedAt"
    FROM places WHERE id = ANY($1::int[]) ORDER BY id`, [[31, 66, 67, 68, 69, 70, 71]]);
  const itineraries = await client.query(`SELECT id, "userId", title, "destinationId", budget, status, "startDate", "endDate"
    FROM itineraries WHERE id = ANY($1::int[]) ORDER BY id`, [[6, 9]]);
  const items = await client.query(`SELECT id, "itineraryId", "placeId", day, "timeSlot", "order"
    FROM itinerary_items WHERE "itineraryId" = ANY($1::int[]) ORDER BY "itineraryId", id`, [[6, 9]]);
  return { ...counts.rows[0], protectedRows: protectedRows.rows, itineraries: itineraries.rows, items: items.rows };
}

async function sequences(client: Client) {
  const result = await client.query(`SELECT sequencename, last_value FROM pg_sequences
    WHERE schemaname = current_schema() AND sequencename = ANY($1::text[]) ORDER BY sequencename`,
    [["places_id_seq", "admin_audit_logs_id_seq"]]);
  assert.equal(result.rows.length, 2);
  return Object.fromEntries(result.rows.map((row: any) => [row.sequencename, Number(row.last_value)])) as Record<string, number>;
}

it("creates, archives and restores only temporary Places through protected HTTP and rolls back failed audits", async () => {
  assert.equal(process.env.PORT, "5054");
  assert.equal(allowedDatabaseName(process.env.DATABASE_URL), "travelmate_c4_restore_20261005");
  await assertIsolatedDatabase();
  const { Client } = await import("pg");
  const { default: bcrypt } = await import("bcrypt");
  const { app } = await import("../../src/app.js");
  const { createAdminPlace, restorePlace } = await import("../../src/modules/admin/admin.service.js");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const prefix = `c1-test-${randomUUID()}`;
  const emailPrefix = `${prefix}-`;
  let server: Server | undefined;
  let usersCreated = 0;
  let usersDeleted = 0;
  let placesCreated = 0;
  let placesDeleted = 0;
  let auditsCreated = 0;
  let auditsDeleted = 0;
  let initial: Awaited<ReturnType<typeof snapshot>> | undefined;
  let initialSequences: Record<string, number> | undefined;
  try {
    initial = await snapshot(client);
    initialSequences = await sequences(client);
    assert.deepEqual([initial.places, initial.discoverable, initial.users, initial.temporary_users, initial.audits], [47, 40, 18, 0, 8]);
    assert.deepEqual(initial.protectedRows.map((row: any) => row.id), [31, 66, 67, 68, 69, 70, 71]);
    assert.deepEqual(initial.itineraries.map((row: any) => row.id), [6, 9]);
    assert.equal(initial.items.length, 6);
    const account = async (role: "admin" | "user") => {
      const id = randomUUID();
      const email = `${emailPrefix}${randomUUID()}@example.invalid`;
      const secret = randomBytes(24).toString("base64url");
      const digest = await bcrypt.hash(secret, 12);
      const inserted = await client.query(`INSERT INTO users (id, name, email, "passwordHash", role, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, now(), now()) RETURNING id`, [id, "C1 temporary", email, digest, role]);
      assert.equal(inserted.rowCount, 1);
      usersCreated++;
      return { id, email, secret };
    };
    const admin = await account("admin");
    const ordinary = await account("user");
    server = await new Promise<Server>((resolve, reject) => {
      const listener = app.listen(5054, "127.0.0.1", () => resolve(listener));
      listener.on("error", reject);
    });
    const base = "http://127.0.0.1:5054";
    const login = async (user: typeof admin) => {
      const result = await request(base, "/api/auth/login", { method: "POST", body: { email: user.email, password: user.secret } });
      assert.equal(result.status, 200);
      return result.body.data.token as string;
    };
    const adminToken = await login(admin);
    const userToken = await login(ordinary);
    const body = {
      destinationId: 1, name: `${prefix}-place`, category: "Attraction",
      description: "Temporary stage 2 regression Place", address: "Kuala Lumpur",
      latitude: 3.139, longitude: 101.687, priceLevel: 4,
      sourceUrl: "https://example.invalid/temporary-place",
      tags: ["culture"], activityTypes: ["walking"], travelStyleTags: ["cultural"],
      displayTags: ["  City Walk  ", "city-walk"],
    };
    const noAuth = await request(base, "/api/admin/places", { method: "POST", body });
    const noRole = await request(base, "/api/admin/places", { method: "POST", token: userToken, body });
    assert.deepEqual([noAuth.status, noRole.status], [401, 403]);
    const deniedInputs = [
      { ...body, id: 1 }, { ...body, deletedAt: null }, { ...body, destinationId: 999999 },
      { ...body, name: " " }, { ...body, description: "" }, { ...body, address: "" },
      { ...body, category: "Test" }, { ...body, category: "tEsT" }, { ...body, category: "Unknown" },
      { ...body, priceLevel: 0 }, { ...body, priceLevel: 5 }, { ...body, latitude: 8 },
      { ...body, longitude: 120 }, { ...body, sourceUrl: "ftp://example.invalid" },
      { ...body, sourceUrl: ["https://u:p", "@", "example.invalid"].join("") },
      { ...body, tags: [] }, { ...body, activityTypes: ["unknown"] },
      { ...body, travelStyleTags: [] }, { ...body, displayTags: Array.from({ length: 11 }, (_, i) => `tag-${i}`) },
    ];
    for (const invalid of deniedInputs) {
      const result = await request(base, "/api/admin/places", { method: "POST", token: adminToken, body: invalid });
      assert.equal(result.status, 400);
    }
    const created = await request(base, "/api/admin/places", { method: "POST", token: adminToken, body });
    assert.equal(created.status, 201);
    const placeId = created.body.data.id as number;
    placesCreated++;
    assert.equal(created.body.data.status, "active");
    const duplicate = await request(base, "/api/admin/places", { method: "POST", token: adminToken, body: { ...body, name: `  ${body.name.toUpperCase()}  ` } });
    assert.deepEqual([duplicate.status, duplicate.body.error?.code], [409, "PLACE_NAME_EXISTS"]);
    const read = async (path: string, token?: string) => request(base, path, { token });
    const publicPath = `/api/places?search=${encodeURIComponent(prefix)}&limit=100`;
    const adminPath = `/api/admin/places?search=${encodeURIComponent(prefix)}&status=all&limit=100`;
    const firstPublic = await read(publicPath);
    const firstAdmin = await read(adminPath, adminToken);
    assert.deepEqual([firstPublic.status, firstAdmin.status], [200, 200]);
    assert.equal(firstPublic.body.data.items.some((item: any) => item.id === placeId), true);
    assert.equal(firstAdmin.body.data.items.find((item: any) => item.id === placeId)?.restorable, false);
    const stored = await client.query(`SELECT "sourceUrl", "displayTags", "priceLevel" FROM places WHERE id=$1`, [placeId]);
    assert.deepEqual(stored.rows[0], { sourceUrl: body.sourceUrl, displayTags: ["city-walk"], priceLevel: 4 });
    const notArchived = await request(base, `/api/admin/places/${placeId}/restore`, { method: "POST", token: adminToken });
    assert.deepEqual([notArchived.status, notArchived.body.error?.code], [409, "PLACE_NOT_ARCHIVED"]);
    const protectedResults = [];
    for (const id of [31, 66, 67, 68, 69, 70, 71]) {
      const result = await request(base, `/api/admin/places/${id}/restore`, { method: "POST", token: adminToken });
      protectedResults.push([id, result.status, result.body.error?.code]);
      assert.equal(result.status, 403);
    }
    assert.equal(protectedResults[0]?.[2], "TEST_PLACE_RESTORE_FORBIDDEN");
    assert.ok(protectedResults.slice(1).every((row) => row[2] === "PROTECTED_PLACE"));
    const missing = await request(base, "/api/admin/places/999999/restore", { method: "POST", token: adminToken });
    assert.equal(missing.status, 404);
    const archived = await request(base, `/api/admin/places/${placeId}`, { method: "DELETE", token: adminToken });
    assert.equal(archived.status, 200);
    const hidden = await read(publicPath);
    const archivedList = await read(`/api/admin/places?status=archived&search=${encodeURIComponent(prefix)}`, adminToken);
    assert.equal(hidden.body.data.items.some((item: any) => item.id === placeId), false);
    assert.equal(archivedList.body.data.items.find((item: any) => item.id === placeId)?.restorable, true);
    const protectedArchive = await read("/api/admin/places?status=archived&limit=100", adminToken);
    assert.ok(protectedArchive.body.data.items.filter((item: any) => [66, 67, 68, 69, 70, 71].includes(item.id)).every((item: any) => item.restorable === false));
    const duplicateArchived = await request(base, "/api/admin/places", { method: "POST", token: adminToken, body: { ...body, name: ` ${body.name.toUpperCase()} ` } });
    assert.deepEqual([duplicateArchived.status, duplicateArchived.body.error?.code], [409, "PLACE_NAME_EXISTS"]);
    const ordinaryRestore = await request(base, `/api/admin/places/${placeId}/restore`, { method: "POST", token: userToken });
    const anonymousRestore = await request(base, `/api/admin/places/${placeId}/restore`, { method: "POST" });
    assert.deepEqual([anonymousRestore.status, ordinaryRestore.status], [401, 403]);
    const beforeRollback = await snapshot(client);
    await assert.rejects(createAdminPlace(randomUUID(), { ...body, name: `${prefix}-rollback` }));
    assert.deepEqual(await snapshot(client), beforeRollback);
    await assert.rejects(restorePlace(randomUUID(), placeId));
    assert.deepEqual(await snapshot(client), beforeRollback);
    const restored = await request(base, `/api/admin/places/${placeId}/restore`, { method: "POST", token: adminToken });
    assert.equal(restored.status, 200);
    assert.deepEqual(restored.body.data, { id: placeId, status: "active", deletedAt: null });
    const visible = await read(publicPath);
    assert.equal(visible.body.data.items.some((item: any) => item.id === placeId), true);
    const repeated = await request(base, `/api/admin/places/${placeId}/restore`, { method: "POST", token: adminToken });
    assert.deepEqual([repeated.status, repeated.body.error?.code], [409, "PLACE_NOT_ARCHIVED"]);
    const audit = await client.query(`SELECT action::text, metadata, "targetId" FROM admin_audit_logs WHERE "targetType"='Place' AND "targetId"=$1 ORDER BY id`, [String(placeId)]);
    assert.deepEqual(audit.rows.map((row) => row.action), ["PLACE_CREATED", "PLACE_ARCHIVED", "PLACE_RESTORED"]);
    assert.deepEqual(audit.rows[0].metadata, { placeId, name: body.name, destinationId: body.destinationId });
    assert.deepEqual(audit.rows[2].metadata, { placeId, name: body.name, destinationId: body.destinationId });
    auditsCreated = audit.rowCount ?? 0;
    console.log(`Stage 2 HTTP: create 201, archive 200, restore 200; anonymous 401, user 403, validation 400 x${deniedInputs.length}, duplicate/repeat 409, protected 403 x7, missing 404`);
    console.log("Stage 2 audits: created/archived/restored 3; failed create/restore audit rollback 2");
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    const temporaryPlaces = await client.query(`SELECT id FROM places WHERE starts_with(name, $1)`, [prefix]);
    const ids = temporaryPlaces.rows.map((row: any) => row.id as number);
    if (ids.length > 0) {
      const removedAudits = await client.query(`DELETE FROM admin_audit_logs WHERE "targetType"='Place' AND "targetId" = ANY($1::text[]) RETURNING id`, [ids.map(String)]);
      auditsDeleted = removedAudits.rowCount ?? 0;
      const removedPlaces = await client.query(`DELETE FROM places WHERE id = ANY($1::int[]) AND starts_with(name, $2) RETURNING id`, [ids, prefix]);
      placesDeleted = removedPlaces.rowCount ?? 0;
    }
    const removedUsers = await client.query(`DELETE FROM users WHERE starts_with(email, $1) RETURNING id`, [emailPrefix]);
    usersDeleted = removedUsers.rowCount ?? 0;
    const final = await snapshot(client);
    const finalSequences = await sequences(client);
    const leftovers = await client.query(`SELECT (SELECT count(*)::int FROM places WHERE starts_with(name, 'c1-test-')) AS places,
      (SELECT count(*)::int FROM users WHERE starts_with(email, 'c1-test-')) AS users`);
    await client.end();
    assert.equal(placesDeleted, placesCreated);
    assert.equal(usersDeleted, usersCreated);
    assert.equal(auditsDeleted, auditsCreated);
    assert.deepEqual(leftovers.rows[0], { places: 0, users: 0 });
    if (initial) assert.deepEqual(final, initial);
    if (initialSequences) {
      assert.equal(finalSequences.places_id_seq! - initialSequences.places_id_seq!, 2);
      assert.equal(finalSequences.admin_audit_logs_id_seq! - initialSequences.admin_audit_logs_id_seq!, 5);
    }
    console.log(`Stage 2 cleanup: users ${usersCreated}/${usersDeleted}, Places ${placesCreated}/${placesDeleted}, audits ${auditsCreated}/${auditsDeleted}; baseline snapshots equal`);
  }
}, 120_000);
