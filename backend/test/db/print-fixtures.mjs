import { readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const mode = process.argv[2];
const prefix = process.argv[3];
if (!/^(setup|cleanup)$/.test(mode ?? "") || !/^c1-test-print-[a-f0-9]{12}-$/.test(prefix ?? "")) {
  throw new Error("A print fixture mode and exact temporary prefix are required.");
}
const { allowedDatabaseName, assertIsolatedDatabase } = await import("./guard.ts");
if (allowedDatabaseName(process.env.DATABASE_URL) !== "travelmate_c4_restore_20261005") {
  throw new Error("Print fixtures require the approved isolate.");
}
await assertIsolatedDatabase();
const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const snapshotFile = join(tmpdir(), `travelmate-print-${prefix.slice(14, -1)}.json`);

async function snapshot() {
  const totals = await client.query(`SELECT
    (SELECT count(*)::int FROM places) AS places,
    (SELECT count(*)::int FROM places WHERE "deletedAt" IS NULL AND lower(category) <> 'test') AS discoverable,
    (SELECT count(*)::int FROM users) AS users,
    (SELECT count(*)::int FROM itineraries) AS itineraries,
    (SELECT count(*)::int FROM itinerary_items) AS items,
    (SELECT count(*)::int FROM admin_audit_logs) AS audit,
    (SELECT count(*)::int FROM users WHERE starts_with(email, 'c1-test-')) AS temp_users`);
  const protectedPlaces = await client.query(`SELECT id, name, category, "destinationId", "priceLevel", "deletedAt", tags, "activityTypes", "travelStyleTags"
    FROM places WHERE id = ANY($1::int[]) ORDER BY id`, [[31, 66, 67, 68, 69, 70, 71]]);
  const fixedItineraries = await client.query(`SELECT id, "userId", title, "destinationId", budget, status, "startDate", "endDate"
    FROM itineraries WHERE id = ANY($1::int[]) ORDER BY id`, [[6, 9]]);
  const fixedItems = await client.query(`SELECT id, "itineraryId", "placeId", day, "timeSlot", "order", notes, "estimatedDuration"
    FROM itinerary_items WHERE "itineraryId" = ANY($1::int[]) ORDER BY "itineraryId", id`, [[6, 9]]);
  return { totals: totals.rows[0], protectedPlaces: protectedPlaces.rows,
    fixedItineraries: fixedItineraries.rows, fixedItems: fixedItems.rows };
}

function assertBaseline(s, users) {
  const expected = { places: 47, discoverable: 40, users, itineraries: 17, items: 18, audit: 8, temp_users: users - 18 };
  if (JSON.stringify(s.totals) !== JSON.stringify(expected) || s.protectedPlaces.length !== 7 ||
      s.fixedItineraries.length !== 2 || s.fixedItems.length !== 6) {
    throw new Error("The isolated print baseline does not match expected counts.");
  }
}

await client.connect();
try {
  if (mode === "setup") {
    const before = await snapshot();
    assertBaseline(before, 20);
    const accounts = await client.query("SELECT id FROM users WHERE starts_with(email, $1) ORDER BY email", [prefix]);
    if (accounts.rows.length !== 2) throw new Error("Exactly two run-specific accounts are required.");
    await writeFile(snapshotFile, JSON.stringify({ before, accountIds: accounts.rows.map((row) => row.id) }), { flag: "wx" });
    const ids = [];
    let insertedItems = 0;
    try {
      await client.query("BEGIN");
      const createTrip = async (owner, title, start, end, budget) => {
        const result = await client.query(`INSERT INTO itineraries ("userId", "destinationId", title, "startDate", "endDate", budget, status, "createdAt", "updatedAt")
          VALUES ($1, 1, $2, $3, $4, $5, 'planned', now(), now()) RETURNING id`, [owner, title, start, end, budget]);
        ids.push(result.rows[0].id);
        return result.rows[0].id;
      };
      const addItem = async (trip, place, day, slot, order, note = null) => {
        await client.query(`INSERT INTO itinerary_items ("itineraryId", "placeId", day, "timeSlot", "order", notes, "estimatedDuration", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, '1 hour', now(), now())`, [trip, place, day, slot, order, note]);
        insertedItems++;
      };
      const [ownerA, ownerB] = accounts.rows.map((row) => row.id);
      const short = await createTrip(ownerA, "Kuala Lumpur Day Plan", "2026-10-20", "2026-10-20", 100);
      for (const [index, place] of [1, 2, 5].entries()) await addItem(short, place, 1, ["Morning", "Afternoon", "Evening"][index], 1);
      const long = await createTrip(ownerA, "多日文化与自然行程 Long City Journey", "2026-10-20", "2026-10-25", 450);
      for (let day = 1; day <= 6; day++) for (let index = 0; index < 8; index++) {
        const slot = ["Morning", "Afternoon", "Evening"][Math.floor(index / 3)];
        const order = index % 3 + 1;
        await addItem(long, [1, 2, 5][index % 3], day, slot, order,
          index === 0 ? "中文备注用于检查长句换行：参观前请核对开放时间，并预留足够时间步行前往下一站。" : null);
      }
      const repeated = await createTrip(ownerA, "Repeated Place Walk", "2026-10-20", "2026-10-21", null);
      await addItem(repeated, 1, 1, "Morning", 1);
      await addItem(repeated, 1, 1, "Afternoon", 1);
      await addItem(repeated, 1, 2, "Morning", 1);
      await createTrip(ownerA, "Empty Plan", null, null, null);
      const privateTrip = await createTrip(ownerB, "Second Traveller Private Plan", null, null, null);
      await addItem(privateTrip, 2, 1, "Morning", 1);
      await client.query("COMMIT");
      process.stdout.write(`PRINT_FIXTURES=${ids.join("|")};ITEMS=${insertedItems}\n`);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      await unlink(snapshotFile).catch(() => undefined);
      throw error;
    }
  } else {
    const saved = JSON.parse(await readFile(snapshotFile, "utf8"));
    const accountIds = saved.accountIds;
    const accounts = await client.query("SELECT id FROM users WHERE id = ANY($1::text[]) AND starts_with(email, $2) ORDER BY id", [accountIds, prefix]);
    if (accounts.rows.length !== 2) throw new Error("Run-specific accounts are missing; cleanup stopped.");
    await client.query("BEGIN");
    try {
      const trips = await client.query("SELECT id FROM itineraries WHERE \"userId\" = ANY($1::text[]) ORDER BY id", [accountIds]);
      if (trips.rows.length !== 5) throw new Error("Temporary itinerary count changed; cleanup stopped.");
      const tripIds = trips.rows.map((row) => row.id);
      const items = await client.query("DELETE FROM itinerary_items WHERE \"itineraryId\" = ANY($1::int[]) RETURNING id", [tripIds]);
      const removedTrips = await client.query("DELETE FROM itineraries WHERE id = ANY($1::int[]) RETURNING id", [tripIds]);
      const removedUsers = await client.query("DELETE FROM users WHERE id = ANY($1::text[]) AND starts_with(email, $2) RETURNING id", [accountIds, prefix]);
      if (items.rowCount !== 55 || removedTrips.rowCount !== 5 || removedUsers.rowCount !== 2) {
        throw new Error("Temporary cleanup affected unexpected row counts.");
      }
      await client.query("COMMIT");
      const after = await snapshot();
      const expected = structuredClone(saved.before);
      expected.totals.users -= 2;
      expected.totals.temp_users -= 2;
      if (JSON.stringify(after) !== JSON.stringify(expected)) throw new Error("Post-cleanup snapshot differs from baseline.");
      await unlink(snapshotFile);
      process.stdout.write("PRINT_CLEANUP=55_ITEMS|5_ITINERARIES|2_USERS;BASELINE_RESTORED\n");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  }
} finally {
  await client.end();
}
