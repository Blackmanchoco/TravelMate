import type { OllamaMessage } from "./ai.types.js";

// The fixed system instruction and tool schemas measured 1,271 tokens in the
// configured model. Dynamic UTF-8 bytes are a conservative token bound; 5,600
// leaves room for chat framing and about 600 tokens beyond the 512 output tokens.
export const MAX_DYNAMIC_CONTEXT_BYTES = 5_600;
const MAX_TOOL_CONTENT_BYTES = 4_000;
const MAX_DESCRIPTION_CHARACTERS = 300;

type BudgetResult = {
  messages: OllamaMessage[];
  pruned: boolean;
  historyMessagesDropped: number;
  toolItemsDropped: number;
  descriptionsTrimmed: number;
  latestCharactersDropped: number;
};

function dynamicBytes(messages: OllamaMessage[]) {
  return Buffer.byteLength(JSON.stringify(messages.slice(1)), "utf8");
}

function compactToolContent(content: string) {
  try {
    const value: unknown = JSON.parse(content);
    if (typeof value !== "object" || value === null || !Array.isArray((value as { items?: unknown }).items)) {
      return { content, itemsDropped: 0, descriptionsTrimmed: 0 };
    }
    const record = value as Record<string, unknown> & { items: unknown[] };
    let descriptionsTrimmed = 0;
    const items = record.items.slice(0, 10).map((entry) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return entry;
      const item = entry as Record<string, unknown>;
      if (typeof item.description !== "string") return entry;
      const characters = Array.from(item.description);
      if (characters.length <= MAX_DESCRIPTION_CHARACTERS) return entry;
      descriptionsTrimmed += 1;
      return { ...item, description: characters.slice(0, MAX_DESCRIPTION_CHARACTERS).join("") };
    });
    const initialCount = record.items.length;
    while (items.length > 1 && Buffer.byteLength(JSON.stringify({ ...record, items }), "utf8") > MAX_TOOL_CONTENT_BYTES) {
      items.pop();
    }
    return {
      content: JSON.stringify({ ...record, items, resultCount: items.length }),
      itemsDropped: initialCount - items.length,
      descriptionsTrimmed,
    };
  } catch {
    return { content, itemsDropped: 0, descriptionsTrimmed: 0 };
  }
}

export function budgetOllamaMessages(input: OllamaMessage[], latestIndex: number): BudgetResult {
  const messages = input.map((entry) => ({ ...entry }));
  const result: BudgetResult = {
    messages, pruned: false, historyMessagesDropped: 0,
    toolItemsDropped: 0, descriptionsTrimmed: 0, latestCharactersDropped: 0,
  };

  while (dynamicBytes(messages) > MAX_DYNAMIC_CONTEXT_BYTES && latestIndex > 1) {
    messages.splice(1, 2);
    latestIndex -= 2;
    result.historyMessagesDropped += 2;
  }

  for (const entry of messages) {
    if (entry.role !== "tool") continue;
    const compacted = compactToolContent(entry.content);
    entry.content = compacted.content;
    result.toolItemsDropped += compacted.itemsDropped;
    result.descriptionsTrimmed += compacted.descriptionsTrimmed;
  }

  for (let index = messages.length - 1; index > latestIndex && dynamicBytes(messages) > MAX_DYNAMIC_CONTEXT_BYTES; index--) {
    const toolMessage = messages[index];
    if (!toolMessage || toolMessage.role !== "tool") continue;
    try {
      const parsed: unknown = JSON.parse(toolMessage.content);
      if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as { items?: unknown }).items)) continue;
      const record = parsed as Record<string, unknown> & { items: unknown[] };
      const items = [...record.items];
      while (items.length > 1 && dynamicBytes(messages) > MAX_DYNAMIC_CONTEXT_BYTES) {
        items.pop();
        result.toolItemsDropped += 1;
        toolMessage.content = JSON.stringify({ ...record, items, resultCount: items.length });
      }
    } catch { /* A non-JSON tool response has no place list to trim. */ }
  }

  if (dynamicBytes(messages) > MAX_DYNAMIC_CONTEXT_BYTES) {
    const current = messages[latestIndex];
    if (!current) throw new Error("The current AI message is missing.");
    const characters = Array.from(current.content);
    let low = 0;
    let high = characters.length;
    while (low < high) {
      const midpoint = Math.ceil((low + high) / 2);
      current.content = midpoint === 0 ? "" : characters.slice(-midpoint).join("");
      if (dynamicBytes(messages) <= MAX_DYNAMIC_CONTEXT_BYTES) low = midpoint;
      else high = midpoint - 1;
    }
    current.content = low === 0 ? "" : characters.slice(-low).join("");
    result.latestCharactersDropped = characters.length - low;
  }

  if (dynamicBytes(messages) > MAX_DYNAMIC_CONTEXT_BYTES) {
    throw new Error("The AI context cannot fit within the configured budget.");
  }
  result.pruned = result.historyMessagesDropped + result.toolItemsDropped
    + result.descriptionsTrimmed + result.latestCharactersDropped > 0;
  return result;
}
