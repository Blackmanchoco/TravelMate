import { apiRequest } from "../lib/api-client";

export type AIHealth = {
  status: "available";
  model: string;
  ollamaVersion: string;
};

export type AIChatResponse = {
  reply: string;
  model: string;
  durationMs: number;
  grounded: boolean;
  suggestedPlaces: Array<{
    placeId: number;
    name: string;
    category: string;
    destinationId: number;
    suggestedSlot: "Morning" | "Afternoon" | "Evening" | null;
  }>;
  toolsUsed: Array<{
    name: "search_places" | "get_personalized_recommendations";
    arguments: {
      destination?: string;
      search?: string;
      limit: number;
    };
    status: "success" | "error";
    resultCount: number;
    durationMs: number;
    errorCode?: string;
  }>;
};

export type AIChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export function getAIHealth(signal?: AbortSignal) {
  return apiRequest<AIHealth>("/ai/health", {
    auth: true,
    signal,
  });
}

export function sendAIChat(
  message: string,
  history: AIChatHistoryMessage[],
  signal?: AbortSignal,
) {
  return apiRequest<AIChatResponse>("/ai/chat", {
    method: "POST",
    body: { message, history },
    auth: true,
    signal,
  });
}
