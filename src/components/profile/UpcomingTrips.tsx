import { CalendarDays, MapPin, Wallet2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { ApiError } from "../../lib/api-client";
import type { ItinerarySummary } from "../../types/itinerary";

interface Props { itineraries: ItinerarySummary[]; isLoading: boolean; error: ApiError | null; onRetry: () => Promise<void>; onOpen: (id: number) => void; }

function dateRange(start: string | null, end: string | null) {
  if (!start && !end) return "Dates not set";
  const format = (value: string) => new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  if (start && end) return `${format(start)} – ${format(end)}`;
  return format((start ?? end)!);
}

export function UpcomingTrips({ itineraries, isLoading, error, onRetry, onOpen }: Props) {
  return <div className="rounded-panel border border-line bg-surface p-6 shadow-panel"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Your itineraries</p><h2 className="mt-2 text-2xl font-semibold text-fg">Recently updated plans</h2></div><Link to="/history" className="shrink-0 text-sm font-semibold text-accent hover:text-accent">View all</Link></div><div className="mt-6 space-y-4">{isLoading ? <p className="text-sm text-muted">Loading itineraries...</p> : error ? <div className="rounded-panel border border-line bg-bg p-4 text-sm text-fg"><p>{error.message}</p><button type="button" onClick={() => void onRetry()} className="mt-2 font-semibold">Try again</button></div> : itineraries.length === 0 ? <p className="rounded-panel border border-dashed border-line bg-bg p-5 text-sm text-muted">No itineraries yet.</p> : itineraries.slice(0, 3).map((trip) => <div key={trip.id} className="rounded-panel border border-line bg-bg p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-fg">{trip.title}</h3><p className="mt-1 text-sm text-muted">{dateRange(trip.startDate, trip.endDate)}</p></div><span className="rounded-full bg-tint px-2.5 py-1 text-xs font-semibold capitalize text-accent">{trip.status}</span></div><div className="mt-4 flex flex-wrap gap-3 text-sm text-muted"><span className="inline-flex items-center gap-1.5"><MapPin size={14} />{trip.destination?.name ?? "Multiple destinations"}</span><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{trip.itemCount} places</span><span className="inline-flex items-center gap-1.5"><Wallet2 size={14} />{trip.budget === null ? "Budget not set" : `RM ${trip.budget.toFixed(2)}`}</span></div><button type="button" onClick={() => onOpen(trip.id)} className="mt-4 text-sm font-semibold text-accent">Open itinerary</button></div>)}</div></div>;
}
