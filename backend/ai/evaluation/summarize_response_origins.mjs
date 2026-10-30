import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { requestedCategory } from "../../dist/modules/ai/ai.category.js";

const input = process.argv[2];
if (!input) throw new Error("Provide a saved raw JSONL file.");
const before = readFileSync(input);
const sha256 = createHash("sha256").update(before).digest("hex");
const rows = before.toString("utf8").trim().split(/\r?\n/).map(JSON.parse);
const classified = rows.map((row) => {
  let origin = "model";
  let reason = "Model reply retained by the handler";
  if (row.kind === "tool") { origin = "direct_tool"; reason = "Direct tool evaluation"; }
  else if (requestedCategory(row.message)) { origin = "server_rule"; reason = "Deterministic category guard and formatter"; }
  else if (/^(?:This comparison covers only|\u672c\u6b21\u6bd4\u8f83\u4ec5\u9650)/u.test(row.reply ?? "") && /: priceLevel /u.test(row.reply ?? "")) {
    origin = "server_rule"; reason = "Deterministic named-set priceLevel comparison";
  }
  else if (row.toolsUsed?.some((tool) => tool.status === "error" || tool.resultCount === 0)) {
    origin = "server_rule"; reason = "Deterministic honest tool fallback";
  } else if (/^(?:These places are in TravelMate's live data\.|TravelMate catalogue matches|These are TravelMate catalogue matches)/u.test(row.reply ?? "")) {
    origin = "server_rule"; reason = "Deterministic labelled discovery or schedule replacement";
  }
  return { caseId: row.caseId, iteration: row.iteration, origin, reason,
    modelCallOccurred: row.kind === "conversation" && row.status === 200,
    pass: row.pass, elapsedMs: row.elapsedMs ?? null };
});
const percentile = (values, fraction) => values.length ? values[Math.ceil(values.length * fraction) - 1] : null;
const summarize = (entries) => {
  const timings = entries.map((entry) => entry.elapsedMs).filter(Number.isFinite).sort((a,b) => a-b);
  return { total: entries.length, passed: entries.filter((entry) => entry.pass).length,
    failed: entries.filter((entry) => !entry.pass).length, latencySamples: timings.length,
    p50Ms: percentile(timings,.5), p95Ms: percentile(timings,.95), p99Ms: percentile(timings,.99) };
};
const classes = Object.fromEntries(["server_rule", "model", "direct_tool"].map((origin) =>
  [origin, summarize(classified.filter((row) => row.origin === origin))]));
const report = { rawFile: input, rawSha256: sha256,
  method: "Reply origin reconstructed from the captured message, tool usage and deterministic handler paths, including the exact named-set priceLevel formatter. This raw format did not record an explicit origin field. All successful conversation requests first called the model, including server-rule replies; model participation is not equivalent to model-authored wording. Direct tool latencies were not recorded. Historical reports retain their original classifications.",
  classes, modelCallOccurred: classified.filter((row) => row.modelCallOccurred).length,
  cases: [...new Set(classified.map((row) => row.caseId))].map((caseId) => ({ caseId,
    ...summarize(classified.filter((row) => row.caseId === caseId)),
    origins: [...new Set(classified.filter((row) => row.caseId === caseId).map((row) => row.origin))] })),
  requests: classified };
const output = input.replace(/\.jsonl$/, ".origins.json");
writeFileSync(output, JSON.stringify(report,null,2)+"\n");
if (createHash("sha256").update(readFileSync(input)).digest("hex") !== sha256) throw new Error("Raw file changed");
console.log(JSON.stringify({ output, rawSha256: sha256, classes, modelCallOccurred: report.modelCallOccurred },null,2));
