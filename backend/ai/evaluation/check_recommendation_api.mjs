import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const scratchName = process.env.RECOMMENDER_SCRATCH_NAME;
if (!/^travelmate_scratch_\d{8}[a-z]$/.test(scratchName ?? "")) {
  throw new Error("RECOMMENDER_SCRATCH_NAME must name an approved scratch database.");
}
const base = "http://localhost:5056/api";
const email = `recommender-${randomBytes(8).toString("hex")}@travelmate.test`;
const password = `${randomBytes(24).toString("base64url")}aA1!`;
const register = await fetch(`${base}/auth/register`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Scratch Recommender Test", email, password }),
});
if (register.status !== 201) throw new Error(`Registration HTTP ${register.status}`);
const token = (await register.json()).data?.token;
if (!token) throw new Error("Registration returned no token.");
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const preference = await fetch(`${base}/users/me/preferences`, {
  method: "PUT", headers,
  body: JSON.stringify({ interests: ["Culture", "Nature"], preferredActivities: ["sightseeing"],
    travelStyle: "Relaxed", budget: "Moderate" }),
});
if (preference.status !== 200) throw new Error(`Preference HTTP ${preference.status}`);
const results = [];
for (const [name, destinationId] of [["Kuala Lumpur", 1], ["Penang", 2], ["Melaka", 3]]) {
  const began = performance.now();
  const response = await fetch(`${base}/recommendations?destinationId=${destinationId}&limit=5`, { headers });
  const payload = await response.json();
  const items = payload.data?.items ?? [];
  const skipped = payload.data?.meta?.skippedCandidates;
  const row = { destination: name, destinationId, status: response.status,
    elapsedMs: Math.round(performance.now() - began), items, skippedCandidates: skipped ?? null };
  results.push(row);
  if (response.status !== 200 || !skipped || !items.length
    || items.some((item) => item.destinationId !== destinationId
      || ["Accommodation", "Restaurant"].includes(item.category))) {
    throw new Error(`Recommendation failed for ${name}: HTTP ${response.status}`);
  }
}
const path = `../docs/place-expansion-2026-10-15/recommender-api-${scratchName}.json`;
writeFileSync(path, `${JSON.stringify({ scratchName, checkedAt: new Date().toISOString(), results }, null, 2)}\n`);
console.log(JSON.stringify({ path, cases: results.map(({ destination, status, items, skippedCandidates }) =>
  ({ destination, status, count: items.length, skippedCandidates })) }));
