import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getItinerary } from "../../api/itineraries.api";
import { getBudgetAlert } from "../../api/budget-alert.api";
import { getPreferenceMatch } from "../../api/preference-match.api";
import { ApiError } from "../../lib/api-client";
import type { ItineraryDetail, ItineraryItem } from "../../types/itinerary";
import type { BudgetAlertResult } from "../../types/budget-alert";
import type { PreferenceMatchResult } from "../../types/preference-match";
import { formatEstimatedCost, groupPrintDays } from "./print-itinerary-model";
import "./print-itinerary.css";

type PrintState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; itinerary: ItineraryDetail; budget: BudgetAlertResult | null; match: PreferenceMatchResult | null; matchUnavailableMessage: string };

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function formatBudget(value: number | null) {
  return value === null ? "Not set" : `RM ${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PlaceEntry({ item, number }: { item: ItineraryItem; number: number }) {
  const coordinates = item.place.latitude !== null && item.place.longitude !== null
    ? `${item.place.latitude.toFixed(5)}, ${item.place.longitude.toFixed(5)}` : null;
  return <article className="print-place">
    <div className="print-place-heading"><span className="print-place-number">{number}.</span><div><p className="print-slot">{item.timeSlot}</p><h4>{item.place.name}</h4></div></div>
    <dl>
      <div><dt>Address</dt><dd>{item.place.address || "Not available"}</dd></div>
      <div><dt>Estimated duration</dt><dd>{item.estimatedDuration || "Not set"}</dd></div>
      {item.notes && <div><dt>Notes</dt><dd>{item.notes}</dd></div>}
      {coordinates && <div><dt>Coordinates</dt><dd>{coordinates}</dd></div>}
    </dl>
  </article>;
}

export default function PrintItinerary() {
  const { id } = useParams<"id">();
  const [state, setState] = useState<PrintState>({ status: "loading" });
  const [generatedAt] = useState(() => new Date());
  const itineraryId = id && /^\d+$/.test(id) ? Number(id) : NaN;
  const validId = Number.isSafeInteger(itineraryId) && itineraryId > 0;

  useEffect(() => {
    if (!validId) { setState({ status: "error", message: "Itinerary not found." }); return; }
    const controller = new AbortController();
    setState({ status: "loading" });
    void Promise.allSettled([
      getItinerary(itineraryId, controller.signal),
      getBudgetAlert(itineraryId, controller.signal),
      getPreferenceMatch(itineraryId, controller.signal),
    ]).then(([detail, budget, match]) => {
      if (controller.signal.aborted) return;
      if (detail.status === "rejected") {
        const message = detail.reason instanceof ApiError && detail.reason.status === 404
          ? "Itinerary not found. It may belong to another account."
          : "Unable to load this itinerary. Please try again.";
        setState({ status: "error", message });
        return;
      }
      setState({ status: "ready", itinerary: detail.value,
        budget: budget.status === "fulfilled" ? budget.value : null,
        match: match.status === "fulfilled" ? match.value : null,
        matchUnavailableMessage: match.status === "rejected"
          && match.reason instanceof ApiError && match.reason.code === "NO_PREFERENCE_SET"
          ? "Set your preferences in Preferences to see a match score."
          : "Summary temporarily unavailable." });
    });
    return () => controller.abort();
  }, [itineraryId, validId]);

  useEffect(() => {
    if (state.status !== "ready") return;
    const previous = document.title;
    document.title = `TravelMate - ${state.itinerary.title}`;
    return () => { document.title = previous; };
  }, [state]);

  const days = useMemo(() => state.status === "ready" ? groupPrintDays(state.itinerary.items) : [], [state]);

  return <main className="print-shell">
    <div className="print-toolbar"><Link to="/itinerary">Back to itinerary</Link><button type="button" disabled={state.status !== "ready"} onClick={() => window.print()}>Print / Save as PDF</button></div>
    {state.status === "loading" && <p role="status" className="print-message">Loading print view and summaries…</p>}
    {state.status === "error" && <div role="alert" className="print-message"><h1>Unable to print itinerary</h1><p>{state.message}</p></div>}
    {state.status === "ready" && <div className="print-document">
      <header className="print-cover">
        <p className="print-brand">TravelMate · Itinerary</p>
        <h1>{state.itinerary.title}</h1>
        <dl className="print-summary-grid">
          <div><dt>Start date</dt><dd>{formatDate(state.itinerary.startDate)}</dd></div>
          <div><dt>End date</dt><dd>{formatDate(state.itinerary.endDate)}</dd></div>
          <div><dt>Destination</dt><dd>{state.itinerary.destination?.name ?? "Multiple destinations"}</dd></div>
          <div><dt>Budget</dt><dd>{formatBudget(state.itinerary.budget)}</dd></div>
        </dl>
        {days.length > 0 && <div className="print-analysis">
          <div><h2>Estimated trip cost</h2>{state.budget
            ? <p>{formatEstimatedCost(state.budget.knownEstimatedCost, state.budget.estimatedCost.complete)}{!state.budget.estimatedCost.complete && ` · ${state.budget.estimatedCost.unknownItemCount} missing price`}</p>
            : <p>Summary temporarily unavailable.</p>}</div>
          <div><h2>Preference match</h2>{state.match?.score !== null && state.match?.score !== undefined
            ? <p>{state.match.score}/100</p> : <p>{state.matchUnavailableMessage}</p>}</div>
        </div>}
      </header>
      {days.length === 0 ? <section className="print-empty"><h2>No places scheduled</h2><p>There are no places in this itinerary yet.</p></section> :
        days.map(({ day, items }) => {
          const cost = state.budget?.days.find((entry) => entry.day === day);
          return <section className="print-day" key={day}>
            <div className="print-day-lead"><h2>Day {day}</h2><PlaceEntry item={items[0]} number={1} /></div>
            {items.slice(1).map((item, index) => <PlaceEntry key={item.id} item={item} number={index + 2} />)}
            <p className="print-day-cost">Daily subtotal: {cost
              ? formatEstimatedCost(cost.knownEstimatedCost, cost.estimatedCost.complete)
              : "Summary temporarily unavailable."}</p>
          </section>;
        })}
      <footer className="print-footer">Generated {new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "long", year: "numeric" }).format(generatedAt)}</footer>
    </div>}
  </main>;
}
