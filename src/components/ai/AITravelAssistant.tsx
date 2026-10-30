import { useState } from "react";
import {
  ArrowRight,
  Bot,
  MessageCircle,
  Sparkles,
  Send,
} from "lucide-react";

import { useNavigate } from "react-router-dom";


function AITravelAssistant() {
  const navigate = useNavigate();

  const [message, setMessage] =
    useState("");

  const suggestions = [
    "What is there to do in Penang?",
    "Recommend some places in Penang for me.",
    "Is Penang Hill a UNESCO heritage site?",
  ];

  const handleSubmit = () => {
    const trimmedMessage =
      message.trim();

    if (!trimmedMessage) {
      navigate("/ai-assistant");
      return;
    }

    navigate(
      `/ai-assistant?prompt=${encodeURIComponent(
        trimmedMessage
      )}`
    );
  };

  const handleSuggestionClick = (
    suggestion: string
  ) => {
    setMessage(suggestion);
  };

  return (
    <section className="relative overflow-hidden bg-accent py-20 sm:py-24">

      {/* Background Decorations */}
      <div className="pointer-events-none absolute inset-0">

        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-accent/40 blur-3xl" />

        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/40 blur-3xl" />

      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        <div className="grid items-center gap-12 lg:grid-cols-2">

          {/* Left Content */}
          <div className="text-accent-fg">

            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-surface/20 bg-surface/10 px-4 py-2 text-sm font-semibold backdrop-blur-sm">

              <Sparkles
                size={16}
                className="text-tint"
              />

              Local AI assistant (qwen3:8b) answering from the TravelMate catalogue

            </div>

            {/* Heading */}
            <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">

              Explore Malaysia with a local AI assistant

              <span className="mt-2 block text-tint">
                (qwen3:8b) answering from the TravelMate catalogue
              </span>

            </h2>

            {/* Description */}
            <p className="mt-6 max-w-xl text-base leading-7 text-tint sm:text-lg">

              Ask about Malaysian places or request recommendations based on your saved preferences. The assistant searches TravelMate's real place catalogue before answering place questions.

            </p>

            {/* Features */}
            <div className="mt-8 grid gap-4 sm:grid-cols-3">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-control bg-surface/10">
                  <Bot size={19} />
                </div>

                <span className="text-sm font-medium">
                  Place Search
                </span>

              </div>

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-control bg-surface/10">
                  <MessageCircle size={19} />
                </div>

                <span className="text-sm font-medium">
                  Interactive Chat
                </span>

              </div>

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-control bg-surface/10">
                  <Sparkles size={19} />
                </div>

                <span className="text-sm font-medium">
                  Personalized
                </span>

              </div>

            </div>

          </div>

          {/* AI Chat Card */}
          <div className="rounded-panel border border-surface/20 bg-surface/10 p-3 shadow-panel backdrop-blur-xl">

            <div className="rounded-panel bg-surface p-6 sm:p-8">

              {/* Card Header */}
              <div className="flex items-center gap-4">

                <div className="flex h-12 w-12 items-center justify-center rounded-panel bg-tint text-accent">
                  <Bot size={25} />
                </div>

                <div>
                  <h3 className="font-bold text-fg">
                    TravelMate AI
                  </h3>

                  <div className="mt-1 flex items-center gap-2">



                    <span className="text-xs text-muted">
                      Sign in to search the TravelMate catalogue
                    </span>

                  </div>
                </div>

              </div>

              {/* AI Message */}
              <div className="mt-6 rounded-panel rounded-tl-sm bg-bg p-4">

                <p className="text-sm leading-6 text-fg">
                  Ask about Malaysian places, compare options, or request recommendations based on your saved preferences.
                </p>

              </div>

              {/* User Input */}
              <div className="mt-5">

                <label
                  htmlFor="ai-message"
                  className="mb-2 block text-sm font-semibold text-fg"
                >
                  What are you looking for?
                </label>

                <div className="flex items-end gap-2 rounded-panel border border-line bg-surface p-2 transition focus-within:border-accent focus-within:ring-3 focus-within:ring-pop">

                  <textarea
                    id="ai-message"
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
                        handleSubmit();
                      }
                    }}
                    placeholder="e.g. What is there to do in Penang?"
                    rows={3}
                    className="min-h-[80px] flex-1 resize-none border-none bg-transparent px-2 py-2 text-sm text-fg outline-none placeholder:text-muted"
                  />

                  <button
                    type="button"
                    onClick={handleSubmit}
                    aria-label="Ask TravelMate AI"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-accent text-accent-fg transition hover:bg-accent active:scale-95"
                  >
                    <Send size={18} />
                  </button>

                </div>

              </div>

              {/* Suggestions */}
              <div className="mt-5">

                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  Try asking
                </p>

                <div className="flex flex-wrap gap-2">

                  {suggestions.map(
                    (suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() =>
                          handleSuggestionClick(
                            suggestion
                          )
                        }
                        className="rounded-full border border-line bg-surface px-3 py-2 text-xs font-medium text-muted transition hover:border-line hover:bg-tint hover:text-accent"
                      >
                        {suggestion}
                      </button>
                    )
                  )}

                </div>

              </div>

              {/* View Assistant */}
              <button
                type="button"
                onClick={() =>
                  navigate("/ai-assistant")
                }
                className="group mt-6 flex w-full items-center justify-center gap-2 rounded-control bg-fg px-5 py-3.5 text-sm font-semibold text-accent-fg transition hover:bg-fg"
              >
                Open AI Travel Assistant

                <ArrowRight
                  size={17}
                  className="transition-transform group-hover:translate-x-1"
                />
              </button>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}

export default AITravelAssistant;
