import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { sendAIChat } from "../api/ai.api";
import type { AIChatHistoryMessage } from "../api/ai.api";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../lib/api-client";
import { aiToolBadge } from "../lib/ai-tool-badge";
import { AIChatContext } from "./ai-chat-context";
import type { ChatMessage, SendOutcome } from "./ai-chat-context";

const welcomeMessage: ChatMessage = {
  id: 1,
  role: "assistant",
  content: "Hi! 👋 I'm TravelMate AI. Ask me about places in Malaysia or request recommendations based on your saved preferences. I use live TravelMate data and can follow the recent conversation in this tab.",
};

function recentHistory(history: AIChatHistoryMessage[]): AIChatHistoryMessage[] {
  const selected = history.slice(-6);
  while (selected.length > 0
    && selected.reduce((length, entry) => length + entry.content.length, 0) > 6_000) {
    selected.splice(0, 2);
  }
  return selected;
}

function UserChatSession({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [isTyping, setIsTyping] = useState(false);
  const nextMessageIdRef = useRef(2);
  const completedHistoryRef = useRef<AIChatHistoryMessage[]>([]);
  const requestPendingRef = useRef(false);
  const chatControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => chatControllerRef.current?.abort(), []);

  const sendMessage = useCallback(async (rawMessage: string): Promise<SendOutcome> => {
    const trimmedMessage = rawMessage.trim();
    if (!trimmedMessage || requestPendingRef.current) return { status: "ignored" };

    const userMessage: ChatMessage = {
      id: nextMessageIdRef.current++,
      role: "user",
      content: trimmedMessage,
    };
    setMessages((previous) => [...previous, userMessage]);
    setIsTyping(true);
    requestPendingRef.current = true;
    const controller = new AbortController();
    chatControllerRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 135_000);

    try {
      const result = await sendAIChat(
        trimmedMessage,
        recentHistory(completedHistoryRef.current),
        controller.signal,
      );
      if (chatControllerRef.current !== controller) return { status: "ignored" };
      completedHistoryRef.current = recentHistory([
        ...completedHistoryRef.current,
        { role: "user", content: trimmedMessage },
        { role: "assistant", content: result.reply },
      ]);
      const assistantMessage: ChatMessage = {
        id: nextMessageIdRef.current++,
        role: "assistant",
        content: result.reply,
        grounded: result.grounded,
        toolsUsed: result.toolsUsed.length,
        toolBadge: aiToolBadge(result.toolsUsed),
        suggestedPlaces: result.suggestedPlaces,
      };
      setMessages((previous) => [...previous, assistantMessage]);
      return { status: "success", model: result.model };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError" && !timedOut) {
        return { status: "ignored" };
      }
      if (chatControllerRef.current !== controller) return { status: "ignored" };
      const errorMessage = timedOut
        ? "The AI request timed out. Please try again."
        : error instanceof ApiError
        ? error.message
        : "The AI response could not be loaded.";
      const assistantMessage: ChatMessage = {
        id: nextMessageIdRef.current++,
        role: "assistant",
        content: `Sorry, I couldn't complete that request. ${errorMessage}`,
      };
      setMessages((previous) => [...previous, assistantMessage]);
      return { status: "error" };
    } finally {
      window.clearTimeout(timeout);
      if (chatControllerRef.current === controller) {
        chatControllerRef.current = null;
        requestPendingRef.current = false;
        setIsTyping(false);
      }
    }
  }, []);

  const newConversation = useCallback(() => {
    chatControllerRef.current?.abort();
    chatControllerRef.current = null;
    requestPendingRef.current = false;
    completedHistoryRef.current = [];
    setIsTyping(false);
    setMessages([{ ...welcomeMessage, id: nextMessageIdRef.current++ }]);
  }, []);

  return <AIChatContext.Provider value={{ messages, isTyping, sendMessage, newConversation }}>
    {children}
  </AIChatContext.Provider>;
}

export function AIChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <UserChatSession key={user?.id ?? "signed-out"}>{children}</UserChatSession>;
}
