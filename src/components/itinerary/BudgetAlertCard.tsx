import { useEffect, useMemo, useRef, useState } from "react";
import { CircleDollarSign, LoaderCircle, RefreshCw } from "lucide-react";

import { getBudgetAlert } from "../../api/budget-alert.api";
import { ApiError } from "../../lib/api-client";
import type { BudgetAlertResult, BudgetAlertStatus, CostRange } from "../../types/budget-alert";
import type { ItineraryItem } from "../../types/itinerary";

const statusPresentation: Record<BudgetAlertStatus, { label: string; badge: string; panel: string }> = {
  WITHIN_BUDGET: {
    label: "Within budget",
    badge: "bg-tint text-accent",
    panel: "border-line bg-tint",
  },
  NEAR_BUDGET: {
    label: "Budget may be tight",
    badge: "bg-tint text-fg",
    panel: "border-line bg-bg",
  },
  OVER_BUDGET: {
    label: "Over budget",
    badge: "bg-tint text-fg",
    panel: "border-line bg-bg",
  },
  NO_BUDGET_SET: {
    label: "Budget not set",
    badge: "bg-line text-fg",
    panel: "border-line bg-bg",
  },
  ESTIMATE_INCOMPLETE: {
    label: "Estimate incomplete",
    badge: "bg-tint text-fg",
    panel: "border-line bg-bg",
  },
};

type BudgetState =
  | { key: string; status: "empty" }
  | { key: string; status: "loading" }
  | { key: string; status: "success"; result: BudgetAlertResult }
  | { key: string; status: "error"; error: ApiError };

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function formatCurrency(value: number | string, currency = "MYR") {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatRange(range: CostRange, currency = "MYR") {
  return `${formatCurrency(range.min, currency)}–${formatCurrency(range.max, currency)}`;
}

function BudgetAlertError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return <div className="mt-6 rounded-panel border border-line bg-bg p-5">
    <p className="text-sm leading-6 text-fg">{error.message || "The budget analysis could not be loaded."}</p>
    <button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg transition hover:bg-tint">
      <RefreshCw size={15} />Retry
    </button>
  </div>;
}

export function BudgetAlertCard({ itineraryId, budget, items }: { itineraryId: number; budget: number | null; items: ItineraryItem[] }) {
  const itemSignature = useMemo(() => [...items]
    .sort((left, right) => left.id - right.id)
    .map((item) => `${item.id}:${item.placeId}:${item.day}`)
    .join(","), [items]);
  const requestKey = `${itineraryId}:${budget ?? "none"}:${itemSignature}`;
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<BudgetState>(() => items.length === 0
    ? { key: requestKey, status: "empty" }
    : { key: requestKey, status: "loading" });
  const requestSequence = useRef(0);

  useEffect(() => {
    if (items.length === 0) {
      requestSequence.current += 1;
      setState({ key: requestKey, status: "empty" });
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestSequence.current;
    setState({ key: requestKey, status: "loading" });

    void getBudgetAlert(itineraryId, controller.signal)
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
            : new ApiError("The budget analysis could not be loaded.", 0, "UNKNOWN_ERROR"),
        });
      });

    return () => controller.abort();
  }, [itineraryId, items.length, requestKey, retryCount]);

  const currentState: BudgetState = state.key === requestKey
    ? state
    : items.length === 0
      ? { key: requestKey, status: "empty" }
      : { key: requestKey, status: "loading" };

  return <section className="rounded-panel border border-line bg-surface p-7 shadow-panel sm:p-9" aria-labelledby="budget-alert-title">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Budget alert</p>
        <h2 id="budget-alert-title" className="mt-2 text-2xl font-semibold text-fg">Estimated trip cost</h2>
        <p className="mt-2 text-sm leading-6 text-muted">A price-level estimate for every scheduled place occurrence, grouped by day.</p>
      </div>
      <div className="rounded-panel bg-tint p-3 text-accent"><CircleDollarSign size={20} /></div>
    </div>

    {currentState.status === "empty" && <div className="mt-6 rounded-panel border border-dashed border-line bg-bg p-5 text-sm leading-6 text-muted">Add at least one place to see this itinerary&apos;s estimated cost and budget status.</div>}

    {currentState.status === "loading" && <div role="status" className="mt-6 flex items-center gap-3 rounded-panel bg-bg p-5 text-sm font-medium text-muted"><LoaderCircle className="animate-spin" size={18} />Checking estimated costs...</div>}

    {currentState.status === "error" && <BudgetAlertError error={currentState.error} onRetry={() => setRetryCount((count) => count + 1)} />}

    {currentState.status === "success" && <BudgetAlertResultView result={currentState.result} />}
  </section>;
}

function BudgetAlertResultView({ result }: { result: BudgetAlertResult }) {
  const presentation = statusPresentation[result.status];
  const displayedRange = result.estimatedCost.complete
    ? { min: result.estimatedCost.min!, max: result.estimatedCost.max! }
    : result.knownEstimatedCost;
  const isIncomplete = !result.estimatedCost.complete;

  return <>
    <div className={`mt-6 rounded-panel border p-6 ${presentation.panel}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted">{isIncomplete ? "Known estimated cost" : "Estimated total cost"}</p>
          <p className="mt-2 text-3xl font-semibold text-fg">{formatRange(displayedRange, result.currency)}</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${presentation.badge}`}>{presentation.label}</span>
      </div>
      <div className="mt-5 border-t border-line/10 pt-4 text-sm text-fg">
        Budget: <span className="font-semibold text-fg">{result.budget === null ? "Not set" : formatCurrency(result.budget, result.currency)}</span>
      </div>
      {result.status === "NO_BUDGET_SET" && <p className="mt-3 text-sm leading-6 text-fg">No budget is set, so the estimate is shown without a budget comparison.</p>}
      {isIncomplete && <p role="alert" className="mt-3 text-sm font-medium leading-6 text-fg">{result.estimatedCost.unknownItemCount} {result.estimatedCost.unknownItemCount === 1 ? "place is" : "places are"} missing price information. This estimate includes known costs only and is incomplete.</p>}
    </div>

    <div className="mt-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">Daily breakdown</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {result.days.map((day) => {
          const dayRange = day.estimatedCost.complete
            ? { min: day.estimatedCost.min!, max: day.estimatedCost.max! }
            : day.knownEstimatedCost;
          return <div key={day.day} className="rounded-panel border border-line bg-bg p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-fg">Day {day.day}</p>
              <p className="text-xs font-medium text-muted">{day.items.length} {day.items.length === 1 ? "place" : "places"}</p>
            </div>
            <p className="mt-3 text-lg font-semibold text-fg">{formatRange(dayRange, result.currency)}</p>
            {!day.estimatedCost.complete && <p className="mt-2 text-xs leading-5 text-fg">Known costs only · {day.estimatedCost.unknownItemCount} missing</p>}
          </div>;
        })}
      </div>
    </div>
  </>;
}
