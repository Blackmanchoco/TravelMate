import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { getPreferenceMatch } from "../../api/preference-match.api";
import { ApiError } from "../../lib/api-client";
import type { ItineraryItem } from "../../types/itinerary";
import type {
  PreferenceMatchDimensionName,
  PreferenceMatchResult,
} from "../../types/preference-match";

const dimensions: Array<{ key: PreferenceMatchDimensionName; label: string }> = [
  { key: "interests", label: "Interests" },
  { key: "activities", label: "Activities" },
  { key: "travelStyle", label: "Travel style" },
  { key: "budget", label: "Budget" },
];

const topLevelMessages: Record<string, string> = {
  NO_PREFERENCE_SET: "Set your travel preferences in Preferences to see how this trip matches them.",
  NO_MATCHABLE_PREFERENCE: "Your saved preference profile does not contain any matchable interests, activities, travel style, or budget.",
  NO_ITEMS: "Add at least one place to see how well this itinerary matches your preferences.",
};

const dimensionReasonLabels: Record<string, string> = {
  NO_USER_INTERESTS: "No interests set",
  NO_USER_ACTIVITIES: "No activities set",
  NO_USER_TRAVEL_STYLE: "No travel style set",
  NO_USER_BUDGET: "No budget preference set",
};

type MatchState =
  | { key: string; status: "loading" }
  | { key: string; status: "success"; result: PreferenceMatchResult }
  | { key: string; status: "error"; error: ApiError };

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function PreferenceMatchError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const message = topLevelMessages[error.code] ?? error.message;
  return <div className="mt-6 rounded-panel border border-line bg-bg p-5">
    <p className="text-sm leading-6 text-fg">{message}</p>
    {error.code === "NO_PREFERENCE_SET" && <Link to="/account-settings" className="mt-3 inline-block text-sm font-semibold text-fg underline underline-offset-2">Open Preferences</Link>}
    <button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg transition hover:bg-tint">
      <RefreshCw size={15} />Retry
    </button>
  </div>;
}

export function PreferenceMatchCard({ itineraryId, items }: { itineraryId: number; items: ItineraryItem[] }) {
  const itemSignature = useMemo(() => [...items]
    .sort((left, right) => left.id - right.id)
    .map((item) => `${item.id}:${item.placeId}`)
    .join(","), [items]);
  const requestKey = `${itineraryId}:${itemSignature}`;
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<MatchState>({ key: requestKey, status: "loading" });
  const requestSequence = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestSequence.current;
    setState({ key: requestKey, status: "loading" });

    void getPreferenceMatch(itineraryId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted && requestSequence.current === requestId) {
          setState({ key: requestKey, status: "success", result });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error) || requestSequence.current !== requestId) return;
        setState({
          key: requestKey,
          status: "error",
          error: error instanceof ApiError
            ? error
            : new ApiError("The preference match could not be loaded.", 0, "UNKNOWN_ERROR"),
        });
      });

    return () => controller.abort();
  }, [itineraryId, requestKey, retryCount]);

  const currentState: MatchState = state.key === requestKey
    ? state
    : { key: requestKey, status: "loading" };

  return <section className="rounded-panel border border-line bg-surface p-7 shadow-panel sm:p-9" aria-labelledby="preference-match-title">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Preference match</p>
        <h2 id="preference-match-title" className="mt-2 text-2xl font-semibold text-fg">How well this trip fits you</h2>
        <p className="mt-2 text-sm leading-6 text-muted">A rule-based comparison of your saved preferences and every scheduled place occurrence.</p>
      </div>
      <div className="rounded-panel bg-tint p-3 text-accent"><Sparkles size={20} /></div>
    </div>

    {currentState.status === "loading" && <div role="status" className="mt-6 flex items-center gap-3 rounded-panel bg-bg p-5 text-sm font-medium text-muted"><LoaderCircle className="animate-spin" size={18} />Checking preference match...</div>}

    {currentState.status === "error" && <PreferenceMatchError error={currentState.error} onRetry={() => setRetryCount((count) => count + 1)} />}

    {currentState.status === "success" && currentState.result.reason === "NO_ITEMS" && <div className="mt-6 rounded-panel border border-dashed border-line bg-bg p-5 text-sm leading-6 text-muted">{topLevelMessages.NO_ITEMS}</div>}

    {currentState.status === "success" && currentState.result.score !== null && currentState.result.breakdown && <>
      <div className="mt-6 flex flex-col gap-4 rounded-panel bg-fg p-6 text-accent-fg sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-medium text-muted">Overall match</p><p className="mt-2 text-5xl font-semibold">{currentState.result.score}<span className="ml-1 text-2xl text-muted">/100</span></p></div>
        <p className="max-w-sm text-sm leading-6 text-muted">Calculated across {currentState.result.breakdown.itemCount} {currentState.result.breakdown.itemCount === 1 ? "item occurrence" : "item occurrences"} using a simple average.</p>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {dimensions.map(({ key, label }) => {
          const dimension = currentState.result.breakdown!.dimensions[key];
          const score = dimension.score === null ? null : Math.max(0, Math.min(100, dimension.score));
          return <div key={key} className="rounded-panel border border-line bg-bg p-5">
            <div className="flex items-center justify-between gap-3"><p className="font-semibold text-fg">{label}</p><p className="text-sm font-semibold text-accent">{score === null ? "Skipped" : `${score.toFixed(1)}%`}</p></div>
            {score === null
              ? <p className="mt-3 text-sm text-muted">{dimensionReasonLabels[dimension.reason ?? ""] ?? dimension.reason ?? "Not included"}</p>
              : <div className="mt-4 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={`${label} match`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${score}%` }} /></div>}
          </div>;
        })}
      </div>
    </>}
  </section>;
}
