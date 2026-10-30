import { env } from "../../config/env.js";
import { AppError } from "../../core/errors/app-error.js";
import { budgetOllamaMessages } from "./ai.context-budget.js";
import { suggestedSlotForPlace } from "./ai.suggested-slot.js";
import { buildOllamaChatBody, OLLAMA_CONTEXT_LENGTH, SYSTEM_INSTRUCTION } from "./ai.request.js";
import {
  categorySpecificPersonalizationReply,
  allowedCategoriesForIntent,
  formatCategoryReply,
  multipleCategoryReply,
  requestedCategory,
  requestedDestination,
  requestsPersonalization,
  type RequestedCategory,
} from "./ai.category.js";
import type {
  AIChatResult,
  AIChatHistoryMessage,
  AIHealthResult,
  AIToolUsage,
  OllamaChatResponse,
  OllamaMessage,
  OllamaToolCall,
} from "./ai.types.js";
import {
  aiToolDefinitions,
  executePersonalizedRecommendationsTool,
  executeSearchPlacesTool,
  findMentionedPublicPlaceNames,
} from "./ai.tools.js";

const HEALTH_TIMEOUT_MS = 5_000;
const TOTAL_CHAT_TIMEOUT_MS = 120_000;
const INITIAL_MODEL_TIMEOUT_MS = 45_000;
const FOLLOW_UP_MODEL_TIMEOUT_MS = 60_000;
const PLACE_TOOL_TIMEOUT_MS = 5_000;
const RECOMMENDATION_TOOL_TIMEOUT_MS = 25_000;
const MAX_TOOL_ROUNDS = 2;
const MAX_TOOL_CALLS_PER_ROUND = 3;
const CJK_MESSAGE = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u;

function toolFallbackReply(message: string, usage: AIToolUsage): string {
  const chinese = CJK_MESSAGE.test(message);
  if (usage.errorCode === "NO_PREFERENCE_SET") {
    return chinese
      ? "您还没有设置偏好，因此暂时无法提供个性化推荐。请先到偏好设置页填写偏好，再试一次。"
      : "Your preferences are not set, so personalized recommendations are unavailable. Set your preferences and try again.";
  }
  if (usage.status === "error") {
    if (usage.name === "get_personalized_recommendations") {
      return chinese
        ? "推荐服务暂不可用，无法提供个性化推荐。请稍后再试。"
        : "The recommendation service is temporarily unavailable. Please try again later.";
    }
    return chinese
      ? "地点搜索服务暂不可用。请稍后再试。"
      : "Place search is temporarily unavailable. Please try again later.";
  }
  return chinese
    ? "没找到符合条件的地点。请换个说法或调整查询条件后再试。"
    : "No places matched your query. Try different wording or search criteria.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function removeUnrequestedDiscoveryCategory(call: OllamaToolCall, message: string): OllamaToolCall {
  if (call.function.name !== "search_places" || requestedCategory(message)) return call;
  let args = call.function.arguments;
  if (typeof args === "string") {
    try { args = JSON.parse(args) as unknown; } catch { return call; }
  }
  if (!isRecord(args) || typeof args.category !== "string"
    || !/^(?:accommodation|hotels?|lodging|food|restaurants?|dining|attractions?|sightseeing|shopping|shops?)$/i.test(args.category)) {
    return call;
  }
  const sanitized = { ...args };
  delete sanitized.category;
  return { ...call, function: { ...call.function, arguments: sanitized } };
}

type SuggestedPlace = AIChatResult["suggestedPlaces"][number];

function toolResultPlaces(content: string): SuggestedPlace[] {
  try {
    const result: unknown = JSON.parse(content);
    if (!isRecord(result) || result.ok !== true || !Array.isArray(result.items)) return [];
    return result.items.flatMap((item: unknown) => {
      if (!isRecord(item) || !Number.isInteger(item.placeId)
        || Number(item.placeId) < 1 || typeof item.name !== "string"
        || typeof item.category !== "string" || !item.category.trim()
        || !Number.isInteger(item.destinationId) || Number(item.destinationId) < 1) return [];
      const activityTypes = Array.isArray(item.activityTypes)
        ? item.activityTypes.filter((value): value is string => typeof value === "string") : [];
      const tags = Array.isArray(item.tags)
        ? item.tags.filter((value): value is string => typeof value === "string") : [];
      return [{ placeId: Number(item.placeId), name: item.name, category: item.category,
        destinationId: Number(item.destinationId), suggestedSlot: suggestedSlotForPlace(activityTypes, tags) }];
    });
  } catch {
    return [];
  }
}

function checkedCategoryResult(content: string, category: RequestedCategory): {
  destination?: string;
  names: string[];
  places: SuggestedPlace[];
  totalMatches: number;
  availableCategories: string[];
} | null {
  try {
    const result: unknown = JSON.parse(content);
    if (!isRecord(result) || result.ok !== true || !Array.isArray(result.items)) return null;
    if (result.items.some((item: unknown) => !isRecord(item)
      || typeof item.category !== "string" || !allowedCategoriesForIntent(category).includes(item.category)
      || !Number.isInteger(item.placeId) || Number(item.placeId) < 1
      || typeof item.name !== "string" || !item.name.trim()
      || !Number.isInteger(item.destinationId) || Number(item.destinationId) < 1)) return null;
    const destination = isRecord(result.destination) && typeof result.destination.name === "string"
      ? result.destination.name : undefined;
    const availableCategories = Array.isArray(result.availableCategories)
      ? result.availableCategories.filter((value: unknown): value is string => typeof value === "string")
      : [];
    return {
      ...(destination ? { destination } : {}),
      names: result.items.map((item: { name: string }) => item.name),
      places: toolResultPlaces(content),
      totalMatches: typeof result.totalMatches === "number" && Number.isFinite(result.totalMatches)
        ? result.totalMatches : result.items.length,
      availableCategories,
    };
  } catch {
    return null;
  }
}

async function requestOllama(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  if (timeoutMs < 1) {
    throw new AppError(
      "The AI service timed out.",
      504,
      "AI_SERVICE_TIMEOUT",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${env.ollamaBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...init.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AppError(
        response.status === 404
          ? "The configured AI model is unavailable."
          : "The AI service returned an error.",
        503,
        response.status === 404 ? "AI_MODEL_UNAVAILABLE" : "AI_SERVICE_UNAVAILABLE",
      );
    }

    try {
      return await response.json() as unknown;
    } catch {
      throw new AppError(
        "The AI service returned an invalid response.",
        502,
        "AI_SERVICE_INVALID_RESPONSE",
      );
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError(
        "The AI service timed out.",
        504,
        "AI_SERVICE_TIMEOUT",
      );
    }

    throw new AppError(
      "The AI service is unavailable.",
      503,
      "AI_SERVICE_UNAVAILABLE",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function isToolCall(value: unknown): value is OllamaToolCall {
  return isRecord(value)
    && isRecord(value.function)
    && typeof value.function.name === "string"
    && "arguments" in value.function;
}

function parseChatResponse(payload: unknown): OllamaChatResponse {
  if (!isRecord(payload)
    || typeof payload.model !== "string"
    || typeof payload.done !== "boolean"
    || !isRecord(payload.message)
    || payload.message.role !== "assistant"
    || typeof payload.message.content !== "string"
    || (payload.message.tool_calls !== undefined
      && (!Array.isArray(payload.message.tool_calls)
        || !payload.message.tool_calls.every(isToolCall)))) {
    throw new AppError(
      "The AI service returned an invalid response.",
      502,
      "AI_SERVICE_INVALID_RESPONSE",
    );
  }

  return payload as OllamaChatResponse;
}

function remainingTime(deadline: number, maximum: number) {
  return Math.min(maximum, Math.floor(deadline - performance.now()));
}

function removeUnsupportedLinks(markdown: string) {
  return markdown
    .replace(/\[([^\]]+)]\([^\s)]+(?:\s+"[^"]*")?\)/g, "$1")
    .replace(/<https?:\/\/[^>]+>/g, "");
}

async function requestChatCompletion(
  messages: OllamaMessage[],
  latestIndex: number,
  deadline: number,
  timeoutMs: number,
  toolsEnabled: boolean,
  stage: "initial" | "follow_up",
) {
  const startedAt = performance.now();
  let payload: unknown;
  try {
    const budgeted = budgetOllamaMessages(messages, latestIndex);
    if (budgeted.pruned) {
      console.info(JSON.stringify({
        event: "ai_context_pruned",
        stage,
        historyMessagesDropped: budgeted.historyMessagesDropped,
        toolItemsDropped: budgeted.toolItemsDropped,
        descriptionsTrimmed: budgeted.descriptionsTrimmed,
        latestCharactersDropped: budgeted.latestCharactersDropped,
      }));
    }
    payload = await requestOllama(
      "/api/chat",
      {
        method: "POST",
        body: JSON.stringify(buildOllamaChatBody(env.ollamaModel, budgeted.messages, toolsEnabled, aiToolDefinitions)),
      },
      remainingTime(deadline, timeoutMs),
    );

    return parseChatResponse(payload);
  } catch (error) {
    const duration = (field: string): number | null => {
      if (!isRecord(payload)) return null;
      const value = payload[field];
      return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
    };
    console.error(JSON.stringify({
      event: "ai_model_failure",
      stage,
      code: error instanceof AppError ? error.code : "AI_MODEL_REQUEST_FAILED",
      durationMs: Math.round(performance.now() - startedAt),
      numCtx: OLLAMA_CONTEXT_LENGTH,
      ollama: {
        totalDurationNs: duration("total_duration"),
        loadDurationNs: duration("load_duration"),
        promptEvalDurationNs: duration("prompt_eval_duration"),
        evalDurationNs: duration("eval_duration"),
      },
    }));
    throw error;
  }
}

export async function getAIHealth(): Promise<AIHealthResult> {
  const [versionPayload, tagsPayload] = await Promise.all([
    requestOllama("/api/version", { method: "GET" }, HEALTH_TIMEOUT_MS),
    requestOllama("/api/tags", { method: "GET" }, HEALTH_TIMEOUT_MS),
  ]);

  if (!isRecord(versionPayload) || typeof versionPayload.version !== "string"
    || !isRecord(tagsPayload) || !Array.isArray(tagsPayload.models)) {
    throw new AppError(
      "The AI service returned an invalid response.",
      502,
      "AI_SERVICE_INVALID_RESPONSE",
    );
  }

  const hasConfiguredModel = tagsPayload.models.some((model) => (
    isRecord(model)
    && (model.name === env.ollamaModel || model.model === env.ollamaModel)
  ));

  if (!hasConfiguredModel) {
    throw new AppError(
      "The configured AI model is unavailable.",
      503,
      "AI_MODEL_UNAVAILABLE",
    );
  }

  return {
    status: "available",
    model: env.ollamaModel,
    ollamaVersion: versionPayload.version,
  };
}

function requestsSchedule(message: string): boolean {
  if (/\b(?:build|create|generate|make|plan|arrange|suggest)\b.{0,80}\b(?:itinerar(?:y|ies)|schedule|trip)\b|\b(?:put|add|schedule)\b.{0,80}\b(?:day\s*\d+|morning|afternoon|evening)\b|(?:安排|规划|規劃|生成|制定).{0,30}(?:行程|日程)|(?:安排|放|排|加).{0,30}(?:第[一二三四五六七八九十\d]+天|早上|上午|下午|晚上)/iu.test(message)) return true;
  const category = requestedCategory(message);
  if (category !== "Accommodation" && category !== "Restaurant") return false;
  const normalized = message.normalize("NFKC").replace(
    /(?:\d+|[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+)\s*\u6708\s*(?:\d+|[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+)\s*\u65e5/gu,
    "",
  );
  // A nights-only stay is not a scheduling request. Bound duration tokens so
  // opening-age/weekly-hours text and calendar dates keep their existing reply.
  return /\b(?:[1-9]\d*|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]*(?:days?|dyas|dasy|dya|dys)\b(?!\s+(?:ago|old|per\s+week|a\s+week)\b)|(?<![\d\u6708/])(?:[1-9]\d*|[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u4e24\u5169]+)\s*[\u5929\u65e5]|\b(?:plann|planing|planning|plannning)\b.{0,80}\b(?:trip|itinerar(?:y|ies)|schedule)\b/iu.test(normalized);
}

function withScheduleLimitation(reply: string, message: string): string {
  if (!requestsSchedule(message)) return reply;
  const sentence = CJK_MESSAGE.test(message)
    ? "聊天无法编排行程；请使用 Itinerary 和 Add 选择日期和时段。"
    : "This chat cannot build a schedule; use Itinerary and Add to choose days and slots.";
  return `${reply}\n\n${sentence}`;
}

function catalogueListReply(places: SuggestedPlace[], message: string): string {
  const names = places.map((place) => `${place.name} (${place.category})`);
  const list = CJK_MESSAGE.test(message)
    ? `TravelMate 目录地点（括号内为存储类别）：${names.join("、")}。`
    : `TravelMate catalogue places (stored categories): ${names.join(", ")}.`;
  return withScheduleLimitation(list, message);
}

export async function sendAIChat(
  message: string,
  userId: string,
  history: AIChatHistoryMessage[] = [],
): Promise<AIChatResult> {
  const startedAt = performance.now();
  const deadline = startedAt + Math.min(
    env.ollamaTimeoutMs,
    TOTAL_CHAT_TIMEOUT_MS,
  );
  const messages: OllamaMessage[] = [
    { role: "system", content: SYSTEM_INSTRUCTION },
    ...history,
    { role: "user", content: message },
  ];
  const toolsUsed: AIToolUsage[] = [];
  const toolPlaces = new Map<number, SuggestedPlace>();
  let toolRounds = 0;
  let response = await requestChatCompletion(
    messages,
    history.length + 1,
    deadline,
    INITIAL_MODEL_TIMEOUT_MS,
    true,
    "initial",
  );

  const category = requestedCategory(message);
  if (category) {
    const chinese = CJK_MESSAGE.test(message);
    if (category === "multiple" || requestsPersonalization(message)) {
      return {
        reply: category === "multiple"
          ? multipleCategoryReply(chinese)
          : categorySpecificPersonalizationReply(chinese),
        model: response.model,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        grounded: false,
        toolsUsed,
        suggestedPlaces: [],
      };
    }

    const priorUserMessage = [...history].reverse().find((entry) => entry.role === "user")?.content;
    const destination = requestedDestination(message)
      ?? (/\bthere\b|那个城市|那個城市|那里|那裡/u.test(message) && priorUserMessage
        ? requestedDestination(priorUserMessage) : undefined);
    const execution = await executeSearchPlacesTool(
      { ...(destination ? { destination } : {}), category, limit: 5 },
      remainingTime(deadline, PLACE_TOOL_TIMEOUT_MS),
    );
    const checked = execution.usage.status === "success"
      ? checkedCategoryResult(execution.content, category) : null;
    const usage: AIToolUsage = execution.usage.status === "success" && !checked
      ? { ...execution.usage, status: "error", resultCount: 0, errorCode: "CATEGORY_RESULT_MISMATCH" }
      : execution.usage;
    toolsUsed.push(usage);
    if (usage.status === "error" || !checked) {
      return {
        reply: toolFallbackReply(message, usage),
        model: response.model,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        grounded: false,
        toolsUsed,
        suggestedPlaces: [],
      };
    }
    return {
      reply: withScheduleLimitation(formatCategoryReply({
        category,
        destination: checked.destination ?? destination,
        names: category === "Attractions" || category === "Shopping"
          ? checked.places.map((place) => `${place.name} (${place.category})`)
          : checked.names,
        totalMatches: checked.totalMatches,
        availableCategories: checked.availableCategories,
        chinese,
      }), message),
      model: response.model,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      grounded: checked.names.length > 0,
      toolsUsed,
      suggestedPlaces: category === "Attractions" || category === "Shopping" ? checked.places : [],
    };
  }

  if (requestsSchedule(message) && !requestsPersonalization(message)) {
    const destination = requestedDestination(message);
    const execution = await executeSearchPlacesTool(
      { ...(destination ? { destination } : {}), limit: 5 },
      remainingTime(deadline, PLACE_TOOL_TIMEOUT_MS),
    );
    const places = execution.usage.status === "success" ? toolResultPlaces(execution.content) : [];
    const fallback = toolFallbackReply(message, execution.usage);
    return {
      reply: places.length > 0 ? catalogueListReply(places, message)
        : execution.usage.status === "success" ? withScheduleLimitation(fallback, message) : fallback,
      model: response.model,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      grounded: places.length > 0,
      toolsUsed: [execution.usage],
      suggestedPlaces: places,
    };
  }

  const priceComparison = /price\s*levels?|价格等级|價格等級/iu.test(message)
    && /compare|comparison|which|lower|higher|cheaper|same|equal|比较|比較|哪个|哪個|更低|更高|相同/iu.test(message);
  if (priceComparison) {
    const chinese = CJK_MESSAGE.test(message);
    let names: string[];
    try {
      names = await findMentionedPublicPlaceNames(message, history, remainingTime(deadline, PLACE_TOOL_TIMEOUT_MS));
    } catch {
      names = [];
    }
    if (names.length < 2) {
      return { reply: chinese ? "请明确指定至少两个目录地点，才能比较它们的 priceLevel。" : "Name at least two catalogue places to compare their priceLevel.",
        model: response.model, durationMs: Math.round(performance.now() - startedAt), grounded: false, toolsUsed, suggestedPlaces: [] };
    }
    const compared: Array<{name:string; price:number|null}> = [];
    const suggestions: SuggestedPlace[] = [];
    for (const name of names) {
      const execution = await executeSearchPlacesTool({ search: name, limit: 1 }, remainingTime(deadline, PLACE_TOOL_TIMEOUT_MS));
      toolsUsed.push(execution.usage);
      let price: number | null = null;
      try {
        const data: unknown = JSON.parse(execution.content);
        if (execution.usage.status === "success" && isRecord(data) && data.ok === true && Array.isArray(data.items)) {
          const exact = data.items.find((item: unknown) => isRecord(item) && typeof item.name === "string"
            && item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
          if (isRecord(exact)) {
            if (Number.isInteger(exact.priceLevel) && Number(exact.priceLevel) >= 1 && Number(exact.priceLevel) <= 4) price = Number(exact.priceLevel);
            suggestions.push(...toolResultPlaces(JSON.stringify({ok:true,items:[exact]})));
          }
        }
      } catch { /* A malformed tool result is unknown, never a zero-price place. */ }
      compared.push({name,price});
    }
    const scope = chinese ? `本次比较仅限 ${names.join(" 和 ")}。` : `This comparison covers only ${names.join(" and ")}.`;
    const values = compared.map(({name,price}) => `${name}: priceLevel ${price ?? (chinese ? "未知" : "unknown")}`).join("; ");
    let conclusion: string;
    if (compared.some(place => place.price === null)) {
      conclusion = chinese ? "存在未知的 priceLevel，无法判断哪个更低。" : "A priceLevel is unknown, so a lower-priceLevel comparison is unavailable.";
    } else {
      const minimum = Math.min(...compared.map(place => place.price!));
      const lowest = compared.filter(place => place.price === minimum).map(place => place.name);
      conclusion = lowest.length === compared.length
        ? chinese ? "这些地点的 priceLevel 相同。" : "These places have the same priceLevel."
        : chinese ? `在本次比较中，${lowest.join(" 和 ")} 的 priceLevel 更低。` : `Within this comparison, ${lowest.join(" and ")} has the lower priceLevel.`;
    }
    return { reply: `${scope} ${values}. ${conclusion}`, model: response.model,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      grounded: compared.every(place => place.price !== null), toolsUsed, suggestedPlaces: suggestions };
  }

  if (!response.message.tool_calls?.length
    && requestsPersonalization(message)
    && /\b(?:recommend\w*|suggest\w*)\b|推荐/iu.test(message)) {
    response = { ...response, message: { ...response.message, tool_calls: [{ function: {
      name: "get_personalized_recommendations", arguments: { limit: 5 },
    } }] } };
  }

  while (response.message.tool_calls?.length) {
    if (toolRounds >= MAX_TOOL_ROUNDS) {
      throw new AppError(
        "The AI service exceeded the tool-call limit.",
        502,
        "AI_TOOL_CALL_LIMIT",
      );
    }

    let toolCalls: OllamaToolCall[] = response.message.tool_calls.slice(
      0,
      MAX_TOOL_CALLS_PER_ROUND,
    );
    if (toolRounds === 0 && toolCalls.some((call) => call.function.name === "search_places")) {
      let namedPlaces: string[];
      try {
        namedPlaces = await findMentionedPublicPlaceNames(message, history, remainingTime(deadline, PLACE_TOOL_TIMEOUT_MS));
      } catch {
        const usage: AIToolUsage = { name: "search_places", arguments: { limit: 5 }, status: "error",
          resultCount: 0, durationMs: 0, errorCode: "PLACE_SEARCH_FAILED" };
        toolsUsed.push(usage);
        return { reply: toolFallbackReply(message, usage), model: response.model,
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
          grounded: false, toolsUsed, suggestedPlaces: [] };
      }
      if (namedPlaces.length > 0) {
        const priorUser = [...history].reverse().find((entry) => entry.role === "user")?.content;
        const destination = requestedDestination(message) ?? (priorUser ? requestedDestination(priorUser) : undefined);
        toolCalls = namedPlaces.slice(0, MAX_TOOL_CALLS_PER_ROUND).map((name) => ({ function: {
          name: "search_places", arguments: { ...(destination ? { destination } : {}), search: name, limit: 1 },
        } }));
      }
    }
    toolCalls = toolCalls.map((call) => removeUnrequestedDiscoveryCategory(call, message));
    messages.push({
      role: "assistant",
      content: response.message.content,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      if (call.function.name !== "search_places"
        && call.function.name !== "get_personalized_recommendations") {
        messages.push({
          role: "tool",
          tool_name: call.function.name,
          content: JSON.stringify({
            ok: false,
            error: {
              code: "UNKNOWN_TOOL",
              message: "The requested tool is not available.",
            },
          }),
        });
        continue;
      }

      const execution = call.function.name === "search_places"
        ? await executeSearchPlacesTool(
            call.function.arguments,
            remainingTime(deadline, PLACE_TOOL_TIMEOUT_MS),
          )
        : await executePersonalizedRecommendationsTool(
            call.function.arguments,
            userId,
            remainingTime(deadline, RECOMMENDATION_TOOL_TIMEOUT_MS),
          );
      toolsUsed.push(execution.usage);
      if (execution.usage.status === "error" || execution.usage.resultCount === 0) {
        return {
          reply: toolFallbackReply(message, execution.usage),
          model: response.model,
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
          grounded: false,
          toolsUsed,
          suggestedPlaces: [],
        };
      }
      if (execution.usage.status === "success") {
        for (const place of toolResultPlaces(execution.content)) {
          toolPlaces.set(place.placeId, place);
        }
      }
      messages.push({
        role: "tool",
        tool_name: call.function.name,
        content: execution.content,
      });
    }

    toolRounds += 1;
    response = await requestChatCompletion(
      messages,
      history.length + 1,
      deadline,
      FOLLOW_UP_MODEL_TIMEOUT_MS,
      toolRounds < MAX_TOOL_ROUNDS,
      "follow_up",
    );
  }

  const reply = removeUnsupportedLinks(response.message.content).trim();
  if (!reply) {
    throw new AppError(
      "The AI service returned an invalid response.",
      502,
      "AI_SERVICE_INVALID_RESPONSE",
    );
  }

  const suggestedPlaces = [...toolPlaces.values()]
    .filter((place) => requestsSchedule(message) || reply.toLocaleLowerCase().includes(place.name.toLocaleLowerCase()))
    .slice(0, 10);
  const modelAssignedSchedule = /\b(?:day\s*\d+|morning|afternoon|evening)\b|第[一二三四五六七八九十\d]+天|早上|上午|下午|傍晚|晚上/iu.test(reply);
  const mixedCategories = new Set([...toolPlaces.values()].map((place) => place.category)).size > 1;
  const broadDiscovery = /^(?:what places|what is there|show me|list |find |explore |any places|places in|where can i go)/iu.test(message.trim())
    || /^(?:有什麼地方|有什么地方|有哪些地方|哪里好玩|哪裡好玩)/u.test(message.trim());
  const labelledDiscoveryReply = mixedCategories && broadDiscovery
    ? CJK_MESSAGE.test(message)
      ? `TravelMate 目录地点（括号内为存储类别）：${[...toolPlaces.values()].map((place) => `${place.name} (${place.category})`).join("、")}。`
      : `TravelMate catalogue places (stored categories): ${[...toolPlaces.values()].map((place) => `${place.name} (${place.category})`).join(", ")}.`
    : null;
  const safeReply = requestsSchedule(message) && suggestedPlaces.length > 0
    ? catalogueListReply(suggestedPlaces, message)
    : labelledDiscoveryReply ?? (suggestedPlaces.length > 0 && modelAssignedSchedule
    ? CJK_MESSAGE.test(message)
      ? `以下地点来自 TravelMate 实时数据。请在添加时自行选择日期和时段：${suggestedPlaces.map((place) => `${place.name} (${place.category})`).join("、")}。`
      : `These places are in TravelMate's live data. Choose the day and slot when adding: ${suggestedPlaces.map((place) => `${place.name} (${place.category})`).join(", ")}.`
    : reply);
  return {
    reply: safeReply,
    model: response.model,
    durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    grounded: toolsUsed.some((tool) => tool.status === "success"),
    toolsUsed,
    suggestedPlaces,
  };
}
