import "dotenv/config";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { aiToolDefinitions } from "../src/modules/ai/ai.tool-definitions.ts";
import { SYSTEM_INSTRUCTION, buildOllamaChatBody } from "../src/modules/ai/ai.request.ts";

const model = process.env.OLLAMA_MODEL?.trim() || "qwen3:8b";
const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434")
  .replace(/\/$/, "");

const messages = [
  { role: "system", content: SYSTEM_INSTRUCTION },
  { role: "user", content: "What attractions are available in Penang?" },
];
const body = buildOllamaChatBody(model, messages, true, aiToolDefinitions, "30m");
const startedAt = performance.now();
const windowsCli = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, "Programs", "Ollama", "ollama.exe") : "";
const ollamaCli = process.env.OLLAMA_CLI_PATH
  || (windowsCli && existsSync(windowsCli) ? windowsCli : "ollama");

try {
  const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
  const result = await response.json();
  const milliseconds = (nanoseconds) =>
    typeof nanoseconds === "number" ? Math.round(nanoseconds / 1e6) : null;
  console.log(JSON.stringify({
    model: result.model,
    load_duration_ms: milliseconds(result.load_duration),
    prompt_eval_duration_ms: milliseconds(result.prompt_eval_duration),
    total_duration_ms: milliseconds(result.total_duration),
    wall_time_ms: Math.round(performance.now() - startedAt),
  }, null, 2));
} finally {
  console.log("ollama ps:");
  try {
    console.log(execFileSync(ollamaCli, ["ps"], { encoding: "utf8" }));
  } catch {
    const response = await fetch(`${ollamaBaseUrl}/api/ps`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Ollama /api/ps returned HTTP ${response.status}`);
    const { models } = await response.json();
    console.log(JSON.stringify(models, null, 2));
  }
}
