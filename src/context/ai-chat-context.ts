import { createContext, useContext } from "react";

import type { AIChatResponse } from "../api/ai.api";

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  grounded?: boolean;
  toolsUsed?: number;
  toolBadge?: string | null;
  suggestedPlaces?: AIChatResponse["suggestedPlaces"];
}

export type SendOutcome = { status: "success"; model: string } | { status: "error" } | { status: "ignored" };

export interface AIChatSession {
  messages: ChatMessage[];
  isTyping: boolean;
  sendMessage: (message: string) => Promise<SendOutcome>;
  newConversation: () => void;
}

export const AIChatContext = createContext<AIChatSession | null>(null);

export function useAIChatSession(): AIChatSession {
  const session = useContext(AIChatContext);
  if (!session) throw new Error("AIChatProvider is missing.");
  return session;
}
