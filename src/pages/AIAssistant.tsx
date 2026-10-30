import PlanningPromptChip from "../components/ai/PlanningPromptChip";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { getAIHealth } from "../api/ai.api";
import { SuggestedPlaceAdd } from "../components/ai/SuggestedPlaceAdd";
import { useItinerary } from "../context/ItineraryContext";
import { useAIChatSession } from "../context/ai-chat-context";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  MapPin,
  Menu,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react";

const ChatMarkdown = lazy(() => import("../components/ai/ChatMarkdown"));

type ConnectionStatus = "checking" | "available" | "unavailable";

const suggestedQuestions = [
  "What are some things to do in Penang?",
  "Recommend some places in Penang based on my preferences.",
  "What attractions are there in Kuala Lumpur?",
  "Is Penang Hill a UNESCO heritage site according to TravelMate's data?",
];

const quickActions = [
  {
    title: "Explore Penang",
    prompt: "What are some things to do in Penang?",
    description: "Find places in Penang from live TravelMate data.",
    icon: <MapPin size={18} />,
  },
  {
    title: "Find food recommendations",
    prompt: "What restaurants are available in Penang?",
    description: "Discover local food spots and dining areas.",
    icon: <Sparkles size={18} />,
  },
  {
    title: "Discover attractions",
    prompt: "What attractions are worth visiting in Kuala Lumpur?",
    description: "Explore the best places to visit in your destination.",
    icon: <MapPin size={18} />,
  },
  {
    title: "Check a place fact",
    prompt: "Is Penang Hill a UNESCO heritage site according to TravelMate's data?",
    description: "Ask a fact question grounded in stored Place data.",
    icon: <Sparkles size={18} />,
  },
];

function AIAssistant() {
  const { itineraries, activeItinerary, addPlace, refreshItineraries } = useItinerary();
  const { messages, isTyping, sendMessage, newConversation } = useAIChatSession();
  const [searchParams] = useSearchParams();

  const initialPrompt =
    searchParams.get("prompt") || "";

  const [message, setMessage] =
    useState("");

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("checking");
  const [connectionLabel, setConnectionLabel] =
    useState("Checking AI connection...");

  const [sidebarOpen, setSidebarOpen] =
    useState(false);
  const chatContainerRef =
    useRef<HTMLDivElement>(null);

  const handledInitialPromptRef =
    useRef<string | null>(null);
  const healthControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    const container = chatContainerRef.current;

    if (!container) {
      return;
    }

    window.requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  const checkConnection = useCallback(async () => {
    healthControllerRef.current?.abort();
    const controller = new AbortController();
    healthControllerRef.current = controller;
    setConnectionStatus("checking");
    setConnectionLabel("Checking AI connection...");

    try {
      const health = await getAIHealth(controller.signal);
      setConnectionStatus("available");
      setConnectionLabel(`${health.model} connected`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setConnectionStatus("unavailable");
      setConnectionLabel("AI service unavailable");
    }
  }, []);

  useEffect(() => {
    void checkConnection();

    return () => {
      healthControllerRef.current?.abort();
    };
  }, [checkConnection]);

  useEffect(() => {
    scrollToBottom();
  }, [isTyping, messages, scrollToBottom]);

  const sendAndUpdate = useCallback(async (rawMessage: string) => {
    setMessage("");
    const outcome = await sendMessage(rawMessage);
    if (outcome.status === "success") {
      setConnectionStatus("available");
      setConnectionLabel(`${outcome.model} connected`);
    } else if (outcome.status === "error") {
      setConnectionStatus("unavailable");
      setConnectionLabel("AI service unavailable");
    }
  }, [sendMessage]);

  /*
   * Receive prompt from Homepage
   */
  useEffect(() => {
    if (!initialPrompt) {
      return;
    }

    if (
      handledInitialPromptRef.current ===
      initialPrompt
    ) {
      return;
    }

    handledInitialPromptRef.current =
      initialPrompt;

    void sendAndUpdate(initialPrompt);
  }, [initialPrompt, sendAndUpdate]);

  /*
   * Send message
   */
  const handleSendMessage = (
    event?: FormEvent
  ) => {
    event?.preventDefault();

    void sendAndUpdate(message);
  };

  const handleNewConversation = () => {
    setMessage("");
    newConversation();
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden bg-bg">

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() =>
            setSidebarOpen(false)
          }
          className="fixed inset-0 z-30 bg-fg/40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40
          flex w-72 flex-col
          border-r border-line
          bg-bg
          transition-transform duration-300
          lg:static
          lg:translate-x-0
          ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >
        <div className="flex h-16 items-center justify-between border-b border-line bg-surface px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              TravelMate AI
            </p>
            <h2 className="text-sm font-semibold text-fg">
              Smart Trip Planner
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-control p-2 text-muted hover:bg-tint lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <button
            type="button"
            onClick={handleNewConversation}
            className="flex w-full items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 py-3 text-sm font-semibold text-fg shadow-panel transition hover:border-line hover:bg-tint hover:text-accent"
          >
            <Plus size={18} />
            New Conversation
          </button>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Current session
            </p>

            <div className="mt-3 rounded-panel border border-line bg-surface p-3 text-sm text-muted shadow-panel">
              Messages stay in this tab while the page is open. They are cleared on refresh, sign out, or account change and are not saved. Replies can use up to 3 recent completed exchanges.
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Quick Actions
            </p>

            <div className="mt-3 grid gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => setMessage(action.prompt)}
                  className="flex items-start gap-3 rounded-panel border border-line bg-surface p-3 text-left shadow-panel transition hover:border-line hover:bg-tint"
                >
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-control bg-tint text-accent">
                    {action.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-fg">{action.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{action.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex min-w-0 flex-1 flex-col">

        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface px-4 sm:px-6">

          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="rounded-control p-2 text-muted hover:bg-tint lg:hidden"
            >
              <Menu size={21} />
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-control bg-tint text-accent">
              <Bot size={21} />
            </div>

            <div>
              <h1 className="text-sm font-bold text-fg sm:text-base">
                TravelMate AI
              </h1>

              <div className="flex items-center gap-2">

                <span
                  className={`h-2 w-2 rounded-full ${
                    connectionStatus === "available"
                      ? "bg-accent"
                      : connectionStatus === "checking"
                        ? "bg-muted"
                        : "bg-fg"
                  }`}
                />

                <span className="text-xs text-muted">
                  {connectionLabel}
                </span>

                {connectionStatus === "unavailable" && (
                  <button
                    type="button"
                    onClick={() => void checkConnection()}
                    className="flex min-h-10 min-w-10 items-center justify-center rounded p-2 text-muted transition hover:bg-tint hover:text-accent"
                    aria-label="Retry AI connection"
                  >
                    <RefreshCw size={13} />
                  </button>
                )}

              </div>
            </div>

          </div>

          <Link
            to="/"
            className="hidden items-center gap-2 rounded-control px-3 py-2 text-sm font-medium text-muted transition hover:bg-tint sm:flex"
          >
            <ArrowLeft size={16} />

            Home
          </Link>

        </div>

        {/* Messages */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto"
          style={{ overflowAnchor: "none" }}
        >

          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
            <div className="mb-8 rounded-panel border border-line bg-tint p-6 shadow-panel">
              <div className="flex items-center gap-2 text-sm font-semibold text-accent">
                <Sparkles size={16} />
                Travel planning assistant
              </div>
              <h2 className="mt-3 text-2xl font-bold text-fg">
                Let's build your perfect Malaysian getaway.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Ask about Malaysian places or request suggestions based on your saved preferences. You can choose an itinerary, day and slot for a suggested place; I cannot add it for you.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {suggestedQuestions.map((suggestion) => (
                  <PlanningPromptChip
                    key={suggestion}
                    label={suggestion}
                    onClick={() => setMessage(suggestion)}
                  />
                ))}
              </div>
            </div>

            {messages.map((chatMessage) => {

              const isUser =
                chatMessage.role === "user";

              return (
                <div
                  key={chatMessage.id}
                  className={`mb-6 flex gap-3 ${
                    isUser
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >

                  {!isUser && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent text-accent-fg">
                      <Bot size={18} />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-panel px-4 py-3 text-sm leading-7 ${
                      isUser
                        ? "rounded-tr-sm bg-accent text-accent-fg"
                        : "rounded-tl-sm bg-surface text-fg shadow-panel ring-1 ring-pop"
                    }`}
                  >
                    {isUser
                      ? <p className="whitespace-pre-wrap">{chatMessage.content}</p>
                      : (
                        <Suspense fallback={<p className="whitespace-pre-wrap">{chatMessage.content}</p>}>
                          <ChatMarkdown content={chatMessage.content} />
                        </Suspense>
                      )}
                    {!isUser && chatMessage.toolBadge && (
                      <p className="mt-2 border-t border-line pt-2 text-xs font-medium text-accent">
                        {chatMessage.toolBadge}
                        {chatMessage.toolsUsed
                          ? ` · ${chatMessage.toolsUsed} tool call${chatMessage.toolsUsed === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    )}
                    {!isUser && chatMessage.suggestedPlaces && chatMessage.suggestedPlaces.length > 0 && (
                      <div className="mt-3 border-t border-line pt-3">
                        <p className="text-xs font-semibold text-muted">Choose where to add a place:</p>
                        <div className="mt-2 space-y-2">
                          {chatMessage.suggestedPlaces.map((place) => <SuggestedPlaceAdd key={place.placeId} place={place}
                            itineraries={itineraries} activeItinerary={activeItinerary} onAdd={addPlace} onRefresh={refreshItineraries} />)}
                        </div>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-line text-muted">
                      <User size={18} />
                    </div>
                  )}

                </div>
              );
            })}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="mb-6 flex gap-3">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent text-accent-fg">
                  <Bot size={18} />
                </div>

                <div className="flex items-center gap-1 rounded-panel rounded-tl-sm bg-surface px-5 py-4 shadow-panel ring-1 ring-pop">

                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted" />

                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:150ms]" />

                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:300ms]" />

                </div>

              </div>
            )}
          </div>

        </div>

        {/* Bottom Input */}
        <div className="shrink-0 border-t border-line bg-surface">

          <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">

            <form
              onSubmit={handleSendMessage}
              className="flex items-end gap-2 rounded-panel border border-line bg-bg p-2 transition focus-within:border-accent focus-within:ring-3 focus-within:ring-pop"
            >

              <textarea aria-label="Message TravelMate AI"
                value={message}
                onChange={(event) =>
                  setMessage(event.target.value)
                }
                onKeyDown={(event) => {

                  if (
                    event.key === "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();

                    handleSendMessage();
                  }

                }}
                placeholder="Ask TravelMate AI anything about your trip..."
                rows={1}
                className="max-h-32 min-h-[44px] flex-1 resize-none border-none bg-transparent px-3 py-3 text-sm text-fg outline-none placeholder:text-muted"
              />

              <button
                type="submit" aria-label="Send message"
                disabled={
                  !message.trim() ||
                  isTyping
                }
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-accent text-accent-fg transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={18} />
              </button>

            </form>

            <p className="mt-2 text-center text-xs text-muted">
              TravelMate AI may make mistakes.
              Please verify important travel information.
            </p>

          </div>

        </div>

      </main>

    </div>
  );
}

export default AIAssistant;

