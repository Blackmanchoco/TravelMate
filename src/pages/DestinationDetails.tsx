import PhotoPlaceholder from "../components/common/PhotoPlaceholder";
import LocalPhoto from "../components/common/LocalPhoto";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, LoaderCircle, MapPin, Search } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getDestination } from "../api/destinations.api";
import { listPlaceCategories, listPlacesByDestination, type ListPlacesByDestinationParams } from "../api/places.api";
import PlaceCard from "../components/destinations/PlaceCard";
import type { Pagination } from "../types/api";
import type { Destination } from "../types/destination";
import type { Place } from "../types/place";

const EMPTY_PAGE: Pagination = { page: 1, limit: 6, total: 0, totalPages: 0 };

function DestinationDetails() {
  const destinationId = Number(useParams().destinationId);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [draft, setDraft] = useState({ search: "", category: "", minRating: "", limit: 6 });
  const [query, setQuery] = useState<ListPlacesByDestinationParams>({ page: 1, limit: 6 });
  const [pagination, setPagination] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrollOnSearchRef = useRef(false);
  const readyToScrollRef = useRef(false);

  useEffect(() => {
    if (!Number.isInteger(destinationId) || destinationId <= 0) { setNotFound(true); setLoading(false); return; }
    let active = true; setLoading(true); setError(""); setNotFound(false);
    Promise.all([getDestination(destinationId), listPlacesByDestination(destinationId, query), listPlaceCategories(destinationId)])
      .then(([destinationResult, placesResult, categoryResult]) => { if (!active) return; setDestination(destinationResult); setPlaces(placesResult.items); setPagination(placesResult.pagination); setCategories(categoryResult); readyToScrollRef.current = scrollOnSearchRef.current; scrollOnSearchRef.current = false; })
      .catch((caught: unknown) => { if (!active) return; scrollOnSearchRef.current = false; readyToScrollRef.current = false; const status = typeof caught === "object" && caught !== null && "status" in caught ? Number(caught.status) : 0; if (status === 404) setNotFound(true); else setError("This destination could not be loaded. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [destinationId, query, retryKey]);

  useEffect(() => {
    if (!loading && readyToScrollRef.current && resultsRef.current) {
      readyToScrollRef.current = false;
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading, places]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted"><LoaderCircle className="animate-spin" />Loading destination...</div>;
  if (notFound) return <ErrorState title="Destination not found" message="The requested destination does not exist." />;
  if (error || !destination) return <ErrorState title="Could not load this page" message={error || "An unexpected response was received."} onRetry={() => setRetryKey((value) => value + 1)} />;

  const submit = (event: React.FormEvent) => { event.preventDefault(); scrollOnSearchRef.current = true; setQuery({ search: draft.search.trim() || undefined, category: draft.category || undefined, minRating: draft.minRating ? Number(draft.minRating) : undefined, page: 1, limit: draft.limit }); };

  return <main className="min-h-[70vh] bg-bg pb-16">
    <section className="relative overflow-hidden bg-fg text-accent-fg"><LocalPhoto src={destination.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" fallback={<PhotoPlaceholder name={destination.name} className="absolute inset-0 h-full opacity-35" />} /><div className="absolute inset-0 bg-gradient-to-r from-fg via-fg/75 to-transparent" /><div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><Link to="/destinations" className="inline-flex items-center gap-2 text-sm font-semibold text-tint hover:text-accent-fg"><ArrowLeft size={16} />All destinations</Link><p className="mt-12 flex items-center gap-2 text-sm text-tint"><MapPin size={16} />{destination.city}, {destination.state}</p><h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{destination.name}</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-tint">{destination.description}</p></div></section>
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-accent">Places</p><h2 className="mt-2 text-3xl font-semibold text-fg">Explore {destination.name}</h2></div><span className="text-sm text-muted">{pagination.total} places</span></div>
      <form onSubmit={submit} className="mt-7 grid gap-4 rounded-panel border border-line bg-surface p-5 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_auto_auto]">
        <input aria-label="Search places" value={draft.search} onChange={(e) => setDraft((v) => ({ ...v, search: e.target.value }))} placeholder="Search places" className="rounded-panel border border-line px-4 py-3 outline-none focus:border-accent" />
        <select aria-label="Place category" value={draft.category} onChange={(e) => setDraft((v) => ({ ...v, category: e.target.value }))} className="rounded-panel border border-line px-4 py-3"><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
        <input aria-label="Minimum rating" type="number" min="0" max="5" step="0.1" value={draft.minRating} onChange={(e) => setDraft((v) => ({ ...v, minRating: e.target.value }))} placeholder="Minimum rating" className="rounded-panel border border-line px-4 py-3" />
        <select aria-label="Places per page" value={draft.limit} onChange={(e) => setDraft((v) => ({ ...v, limit: Number(e.target.value) }))} className="rounded-panel border border-line px-4 py-3"><option value={3}>3 per page</option><option value={6}>6 per page</option><option value={10}>10 per page</option></select>
        <button className="inline-flex items-center justify-center gap-2 rounded-panel bg-accent px-5 py-3 font-semibold text-accent-fg"><Search size={16} />Apply</button>
      </form>
      <div ref={resultsRef} className="mt-7 scroll-mt-28">
        {places.length ? <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{places.map((place) => <PlaceCard key={place.id} place={place} />)}</div> : <div className="rounded-panel border bg-surface p-8 text-center text-muted">No places match these filters.</div>}
      </div>
      {pagination.totalPages > 1 && <div className="mt-8 flex justify-center gap-4"><button disabled={pagination.page <= 1} onClick={() => setQuery((v) => ({ ...v, page: (v.page ?? 1) - 1 }))} className="rounded-full border bg-surface px-4 py-2 disabled:opacity-40">Previous</button><span className="py-2 text-sm">Page {pagination.page} of {pagination.totalPages}</span><button disabled={pagination.page >= pagination.totalPages} onClick={() => setQuery((v) => ({ ...v, page: (v.page ?? 1) + 1 }))} className="rounded-full border bg-surface px-4 py-2 disabled:opacity-40">Next</button></div>}
    </section>
  </main>;
}

function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) { return <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4 text-center"><div className="rounded-panel border border-line bg-surface p-10 shadow-panel"><p className="text-sm font-semibold uppercase tracking-wider text-accent">{onRetry ? "Load error" : "404"}</p><h1 className="mt-3 text-3xl font-semibold text-fg">{title}</h1><p className="mt-3 text-muted">{message}</p>{onRetry && <button type="button" onClick={onRetry} className="mr-3 mt-6 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-fg">Retry</button>}<Link to="/destinations" className="mt-6 inline-flex rounded-full bg-fg px-5 py-3 text-sm font-semibold text-accent-fg">Back to destinations</Link></div></div>; }

export default DestinationDetails;
