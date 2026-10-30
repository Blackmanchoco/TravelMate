import { randomUUID } from "node:crypto";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("The demo database setting is missing.");
const target = new URL(connectionString).pathname.slice(1);
if (!/^travelmate_demo_\d{8}$/.test(target)) {
  throw new Error("The seed accepts only a full demo database name.");
}

let input = "";
for await (const chunk of process.stdin) input += chunk;
const credentials = JSON.parse(input);
if (!credentials ||
    typeof credentials.adminPassword !== "string" ||
    typeof credentials.userPassword !== "string" ||
    ![credentials.adminPassword, credentials.userPassword].every((value) => value.length >= 8 && value.length <= 128)) {
  throw new Error("Both demo passwords must have 8–128 characters.");
}

const [{ default: bcrypt }, { default: pg }] = await Promise.all([
  import("bcrypt"),
  import("pg"),
]);
const client = new pg.Client({ connectionString });
let committed = false;
try {
  await client.connect();
  const identity = await client.query("SELECT current_database() AS name");
  if (identity.rows[0]?.name !== target) throw new Error("The connected database is not the demo database.");

  const adminHash = await bcrypt.hash(credentials.adminPassword, 12);
  const userHash = await bcrypt.hash(credentials.userPassword, 12);
  const adminId = `demo-admin-${randomUUID()}`;
  const userId = `demo-user-${randomUUID()}`;
  const emailDomain = "example.com";
  const adminEmail = ["demo.admin", emailDomain].join("@");
  const userEmail = ["demo.user", emailDomain].join("@");

  await client.query("BEGIN");
  const baseline = await client.query(`
    SELECT (SELECT count(*) FROM users) AS users,
           (SELECT count(*) FROM user_preferences) AS preferences,
           (SELECT count(*) FROM destinations) AS destinations,
           (SELECT count(*) FROM places) AS places,
           (SELECT count(*) FROM saved_places) AS saved,
           (SELECT count(*) FROM itineraries) AS itineraries,
           (SELECT count(*) FROM itinerary_items) AS items,
           (SELECT count(*) FROM admin_audit_logs) AS audit
  `);
  const expected = [0, 0, 6, 40, 0, 0, 0, 0];
  if (Object.values(baseline.rows[0]).some((value, index) => Number(value) !== expected[index])) {
    throw new Error("The demo database does not match the cleared baseline.");
  }
  const places = await client.query(`
    SELECT id, "destinationId", "priceLevel", latitude, longitude
    FROM places
    WHERE id = ANY($1::int[]) AND "deletedAt" IS NULL AND lower(btrim(category)) <> 'test'
    ORDER BY id
  `, [[1, 2, 5]]);
  if (places.rows.length !== 3 ||
      places.rows.some((place) => place.destinationId !== 1 || place.priceLevel === null || place.latitude === null || place.longitude === null)) {
    throw new Error("The three approved demo places are unavailable.");
  }

  await client.query(`INSERT INTO users
    (id, name, email, "passwordHash", role, "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, 'admin', now(), now()),
           ($5, $6, $7, $8, 'user', now(), now())`,
    [adminId, "Demo Administrator", adminEmail, adminHash,
     userId, "Demo Traveller", userEmail, userHash]);
  await client.query(`INSERT INTO user_preferences
    ("userId", budget, "travelStyle", interests, "preferredActivities", "dietaryPreferences", "createdAt", "updatedAt")
    VALUES ($1, 'mid', 'relaxed', $2, $3, ARRAY[]::text[], now(), now())`,
    [userId, ["culture", "food", "nature"], ["sightseeing", "photography", "walking"]]);
  const itinerary = await client.query(`INSERT INTO itineraries
    ("userId", "destinationId", title, "startDate", "endDate", budget, status, "createdAt", "updatedAt")
    VALUES ($1, 1, 'Demo Kuala Lumpur Day Trip', DATE '2026-10-21', DATE '2026-10-21', 200, 'planned', now(), now())
    RETURNING id`, [userId]);
  const itineraryId = itinerary.rows[0].id;
  const positions = [[1, "Morning"], [2, "Afternoon"], [5, "Evening"]];
  for (const [placeId, slot] of positions) {
    await client.query(`INSERT INTO itinerary_items
      ("itineraryId", "placeId", day, "timeSlot", "order", "createdAt", "updatedAt")
      VALUES ($1, $2, 1, $3, 1, now(), now())`, [itineraryId, placeId, slot]);
  }
  await client.query("COMMIT");
  committed = true;
  process.stdout.write("SEED_COUNTS=2|1|6|40|0|1|3|0\n");

  const base = "http://127.0.0.1:5055/api";
  async function readJson(path, options = {}) {
    const response = await fetch(`${base}${path}`, options);
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(`HTTP verification failed at ${path}: ${response.status}`);
    return { status: response.status, data: payload.data };
  }
  const login = (email, password) => readJson("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const adminLogin = await login(adminEmail, credentials.adminPassword);
  const userLogin = await login(userEmail, credentials.userPassword);
  if (adminLogin.data.user.role !== "admin" || userLogin.data.user.role !== "user") {
    throw new Error("Demo login roles are incorrect.");
  }
  const adminAuth = { Authorization: `Bearer ${adminLogin.data.token}` };
  const userAuth = { Authorization: `Bearer ${userLogin.data.token}` };
  const users = await readJson("/admin/users?limit=10", { headers: adminAuth });
  if (users.data.pagination.total !== 2) throw new Error("Admin user list is not limited to the two demo accounts.");
  const trips = await readJson("/itineraries?limit=10", { headers: userAuth });
  if (trips.data.pagination.total !== 1) throw new Error("The demo user itinerary is missing.");
  const detail = await readJson(`/itineraries/${itineraryId}`, { headers: userAuth });
  if (detail.data.items.length !== 3 || detail.data.items.some((item) => !item.place.latitude || !item.place.longitude)) {
    throw new Error("The demo itinerary is missing map-ready places.");
  }
  const budget = await readJson(`/itineraries/${itineraryId}/budget-alert`, { headers: userAuth });
  const match = await readJson(`/itineraries/${itineraryId}/preference-match`, { headers: userAuth });
  if (budget.data.status !== "NEAR_BUDGET" || match.data.score === null) {
    throw new Error("The demo budget or preference summary is not displayable.");
  }
  process.stdout.write("HTTP_LOGIN=200,200;ADMIN_USERS=2;ITINERARY_ITEMS=3;BUDGET=NEAR_BUDGET;MATCH=AVAILABLE\n");
} catch (error) {
  if (!committed) await client.query("ROLLBACK").catch(() => undefined);
  const detail = error instanceof Error ? error.message : "Unknown error.";
  throw new Error(committed ? `Demo seed committed; subsequent verification failed: ${detail}` : `Demo seed rolled back: ${detail}`);
} finally {
  await client.end().catch(() => undefined);
}
