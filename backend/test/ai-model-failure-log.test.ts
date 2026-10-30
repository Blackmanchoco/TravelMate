import { afterEach, expect, it, vi } from "vitest";

vi.mock("../src/config/env.js", () => ({
  env: { ollamaBaseUrl: "http://127.0.0.1:11434", ollamaModel: "qwen3:8b", ollamaTimeoutMs: 120_000 },
}));
vi.mock("../src/modules/ai/ai.tools.js", () => ({
  aiToolDefinitions: [],
  executeSearchPlacesTool: vi.fn(),
  executePersonalizedRecommendationsTool: vi.fn(),
}));

import { sendAIChat } from "../src/modules/ai/ai.service.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("logs only fixed model-stage fields when the first Ollama call times out", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("private transport detail", "AbortError")));

  await expect(sendAIChat("private message", "private-user")).rejects.toMatchObject({ code: "AI_SERVICE_TIMEOUT" });

  expect(spy).toHaveBeenCalledTimes(1);
  const entry = JSON.parse(String(spy.mock.calls[0][0]));
  expect(entry).toMatchObject({
    event: "ai_model_failure",
    stage: "initial",
    code: "AI_SERVICE_TIMEOUT",
    numCtx: 8_192,
    ollama: {
      totalDurationNs: null,
      loadDurationNs: null,
      promptEvalDurationNs: null,
      evalDurationNs: null,
    },
  });
  expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(entry)).not.toMatch(/private message|private-user|private transport detail/);
});

it("includes available Ollama duration fields on invalid model responses", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    total_duration: 1_000_000,
    load_duration: 200_000,
    prompt_eval_duration: 300_000,
    eval_duration: 400_000,
    message: "private model content",
  }), { status: 200 })));

  await expect(sendAIChat("private message", "private-user")).rejects.toMatchObject({ code: "AI_SERVICE_INVALID_RESPONSE" });
  const entry = JSON.parse(String(spy.mock.calls[0][0]));
  expect(entry).toMatchObject({
    stage: "initial",
    code: "AI_SERVICE_INVALID_RESPONSE",
    ollama: {
      totalDurationNs: 1_000_000,
      loadDurationNs: 200_000,
      promptEvalDurationNs: 300_000,
      evalDurationNs: 400_000,
    },
  });
  expect(JSON.stringify(entry)).not.toMatch(/private message|private-user|private model content/);
});

it("logs only counts when the AI context is pruned", async () => {
  const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    model: "qwen3:8b", done: true, message: { role: "assistant", content: "Done." },
  }), { status: 200 })));

  await sendAIChat("private query ".repeat(400).slice(0, 4_000), "private-user", [
    { role: "user", content: "private history ".repeat(200) },
    { role: "assistant", content: "previous answer" },
  ]);

  expect(spy).toHaveBeenCalledTimes(1);
  const entry = JSON.parse(String(spy.mock.calls[0][0]));
  expect(entry).toMatchObject({ event: "ai_context_pruned", stage: "initial" });
  expect(entry.historyMessagesDropped).toBeGreaterThan(0);
  expect(JSON.stringify(entry)).not.toMatch(/private query|private history|private-user/);
});
