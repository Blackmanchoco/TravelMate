import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { listItineraries } from "../api/itineraries.api";
import { useItinerary } from "../context/ItineraryContext";
import { ApiError } from "../lib/api-client";
import type { Paginated } from "../types/api";
import type { ItinerarySummary } from "../types/itinerary";

const DEFAULT_LIMIT = 10;

function positiveInteger(value: string | null, fallback: number, maximum?: number) {
  const parsed = Number(value);
  return value !== null && Number.isInteger(parsed) && parsed > 0 && (maximum === undefined || parsed <= maximum)
    ? parsed
    : fallback;
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function dateRange(start: string | null, end: string | null) {
  const first = formatDate(start);
  const last = formatDate(end);
  if (first && last) return `${first} – ${last}`;
  return first ?? last ?? "Dates not set";
}

export default function MyItineraries() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectItinerary } = useItinerary();
  const page = positiveInteger(searchParams.get("page"), 1);
  const limit = positiveInteger(searchParams.get("limit"), DEFAULT_LIMIT, 100);
  const [result, setResult] = useState<Paginated<ItinerarySummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const openingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);
    void listItineraries(page, limit, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(caught instanceof ApiError ? caught.message : "The itineraries could not be loaded.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, limit, retry]);

  const changePage = (nextPage: number) => {
    setSearchParams({ page: String(nextPage), limit: String(limit) });
  };

  const openItinerary = async (id: number) => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpeningId(id);
    setOpenError(null);
    try {
      if (await selectItinerary(id)) {
        navigate("/itinerary");
      } else {
        setOpenError("Unable to open this itinerary. Please refresh the list and try again.");
      }
    } catch {
      setOpenError("Unable to open this itinerary. Please refresh the list and try again.");
    } finally {
      openingRef.current = false;
      setOpeningId(null);
    }
  };

  return (
    <main className="min-h-[70vh] bg-bg px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link to="/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent"><ArrowLeft size={16} /> Back to profile</Link>
        <h1 className="mt-5 text-3xl font-semibold text-fg sm:text-4xl">My Itineraries</h1>
        <p className="mt-3 text-muted">Your current itineraries appear here. Deleted itineraries cannot be restored.</p>
        <p className="mt-2 text-sm font-medium text-muted">Recently updated</p>

        {loading && <p role="status" className="mt-8 rounded-panel border border-line bg-surface p-6 text-muted">Loading itineraries...</p>}
        {!loading && error && (
          <div role="alert" className="mt-8 rounded-panel border border-line bg-surface p-6 text-fg">
            <p>{error}</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 rounded-full bg-fg px-5 py-2.5 font-semibold text-accent-fg">Try again</button>
          </div>
        )}
        {openError && <p role="alert" className="mt-8 rounded-panel border border-line bg-surface p-6 text-fg">{openError}</p>}
        {!loading && !error && result && result.pagination.total === 0 && (
          <div className="mt-8 rounded-panel border border-dashed border-line bg-surface p-8 text-muted">No itineraries yet.</div>
        )}
        {!loading && !error && result && result.pagination.total > 0 && (
          <>
            <p className="mt-8 text-sm text-muted">{result.pagination.total} {result.pagination.total === 1 ? "itinerary" : "itineraries"}</p>
            {result.items.length === 0 && <p className="mt-4 rounded-panel border border-line bg-surface p-6 text-muted">No itineraries on this page.</p>}
            <div className="mt-4 space-y-4">
              {result.items.map((trip) => (
                <article key={trip.id} className="rounded-panel border border-line bg-surface p-6 shadow-panel">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-fg">{trip.title}</h2>
                      <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted"><CalendarDays size={15} />{dateRange(trip.startDate, trip.endDate)}</p>
                    </div>
                    <span className="rounded-full bg-tint px-3 py-1 text-xs font-semibold capitalize text-accent">{trip.status}</span>
                  </div>
                  <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted"><MapPin size={15} />{trip.destination?.name ?? "Multiple destinations"} · {trip.itemCount} {trip.itemCount === 1 ? "place" : "places"}</p>
                  <p className="mt-2 text-xs text-muted">Updated {formatDate(trip.updatedAt)}</p>
                  <button type="button" disabled={openingId !== null} onClick={() => openItinerary(trip.id)} className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg disabled:cursor-wait disabled:opacity-60">{openingId === trip.id ? "Opening..." : "Open itinerary"}</button>
                </article>
              ))}
            </div>
            <div className="mt-8 flex items-center justify-between gap-4">
              <button type="button" disabled={page <= 1 || loading} onClick={() => changePage(page - 1)} className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-fg disabled:opacity-40">Previous</button>
              <span className="text-sm text-muted">Page {page} of {result.pagination.totalPages}</span>
              <button type="button" disabled={page >= result.pagination.totalPages || loading} onClick={() => changePage(page + 1)} className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-fg disabled:opacity-40">Next</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
