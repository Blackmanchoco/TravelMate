import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.startsWith("/travelmate_scratch_")) {
  throw new Error("Catalogue invariant requires an explicit scratch database.");
}
const pool = new Pool({ connectionString: databaseUrl });
try {
  const catalogue = await pool.query('SELECT id, name, category FROM places WHERE "deletedAt" IS NULL AND lower(btrim(category)) <> $1', ["test"]);
  const destinations = await pool.query('SELECT name FROM destinations ORDER BY name');
  const byId = new Map(catalogue.rows.map((place) => [place.id, place]));
  const { executeSearchPlacesTool } = await import("../../dist/modules/ai/ai.tools.js");
  const intents = [
    { category: "Attractions", allowed: ["Attraction", "Culture", "Historical", "Nature"] },
    { category: "Restaurant", allowed: ["Restaurant"] },
    { category: "Accommodation", allowed: ["Accommodation"] },
    { category: "Shopping", allowed: ["Shopping"] },
    { category: null, allowed: [...new Set(catalogue.rows.map((place) => place.category))] },
  ];
  const checks = [];
  for (const destination of destinations.rows) {
    for (const intent of intents) {
      const request = { destination: destination.name, limit: 10,
        ...(intent.category ? { category: intent.category } : {}) };
      const execution = await executeSearchPlacesTool(request, 10_000);
      if (execution.usage.status !== "success") throw new Error(`${JSON.stringify(request)}: ${execution.content}`);
      const result = JSON.parse(execution.content);
      for (const item of result.items) {
        const stored = byId.get(item.placeId);
        if (!stored || stored.name !== item.name || stored.category !== item.category
          || !intent.allowed.includes(item.category)) {
          throw new Error(`Catalogue invariant failed: ${JSON.stringify({ request, item, stored })}`);
        }
      }
      checks.push({ destination: destination.name, intent: intent.category ?? "unrestricted",
        resultCount: result.resultCount, totalMatches: result.totalMatches,
        categories: [...new Set(result.items.map((item) => item.category))] });
    }
  }
  console.log(JSON.stringify({ database: new URL(databaseUrl).pathname.slice(1), cataloguePlaces: catalogue.rows.length,
    checks, passed: checks.length }, null, 2));
} finally {
  await pool.end();
}
