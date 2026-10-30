export type AIHealthResult = {
  status: "available";
  model: string;
  ollamaVersion: string;
};

export type AIChatResult = {
  reply: string;
  model: string;
  durationMs: number;
  grounded: boolean;
  toolsUsed: AIToolUsage[];
  suggestedPlaces: Array<{
    placeId: number;
    name: string;
    category: string;
    destinationId: number;
    suggestedSlot: "Morning" | "Afternoon" | "Evening" | null;
  }>;
};

export type AIChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIToolUsage = {
  name: "search_places" | "get_personalized_recommendations";
  arguments: {
    destination?: string;
    search?: string;
    category?: string;
    limit: number;
  };
  status: "success" | "error";
  resultCount: number;
  durationMs: number;
  errorCode?: string;
};

export type OllamaToolCall = {
  type?: string;
  function: {
    name: string;
    arguments: unknown;
  };
};

export type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_name?: string;
  tool_calls?: OllamaToolCall[];
};

export type OllamaChatResponse = {
  model: string;
  message: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
};
