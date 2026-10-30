import { useEffect, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { listDestinations, type ListDestinationsParams } from "../api/destinations.api";
import DestinationCard from "../components/destinations/DestinationCard";
import type { Pagination } from "../types/api";
import type { Destination } from "../types/destination";

const EMPTY_PAGE: Pagination = { page: 1, limit: 6, total: 0, totalPages: 0 };

function DestinationsLive() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search")?.trim() ?? "";
  const [draft, setDraft] = useState({ search: initialSearch, city: "", state: "", limit: 6 });
  const [query, setQuery] = useState<ListDestinationsParams>({ search: initialSearch || undefined, page: 1, limit: 6 });
  const [items, setItems] = useState<Destination[]>([]);
  const [pagination, setPagination] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    listDestinations(query).then((result) => { if (active) { setItems(result.items); setPagination(result.pagination); } }).catch(() => { if (active) setError("Destinations could not be loaded. Please try again."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);

  const submit = (event: React.FormEvent) => { event.preventDefault(); setQuery({ search: draft.search.trim() || undefined, city: draft.city.trim() || undefined, state: draft.state.trim() || undefined, page: 1, limit: draft.limit }); };

  return <main className="min-h-[70vh] bg-bg">
    <section className="bg-bg"><div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Malaysia</p><h1 className="mt-3 text-4xl font-semibold text-fg sm:text-5xl">Explore real destinations</h1><p className="mt-4 max-w-2xl text-lg text-muted">Browse TravelMate's live destination catalogue across Malaysia.</p></div></section>
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <form onSubmit={submit} className="grid gap-4 rounded-panel border border-line bg-surface p-6 shadow-panel md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_auto_auto]">
        <input aria-label="Search destinations" value={draft.search} onChange={(e) => setDraft((v) => ({ ...v, search: e.target.value }))} placeholder="Search name or description" className="rounded-panel border border-line px-4 py-3 outline-none focus:border-accent" />
        <input aria-label="Filter by city" value={draft.city} onChange={(e) => setDraft((v) => ({ ...v, city: e.target.value }))} placeholder="City" className="rounded-panel border border-line px-4 py-3 outline-none focus:border-accent" />
        <input aria-label="Filter by state" value={draft.state} onChange={(e) => setDraft((v) => ({ ...v, state: e.target.value }))} placeholder="State" className="rounded-panel border border-line px-4 py-3 outline-none focus:border-accent" />
        <select aria-label="Results per page" value={draft.limit} onChange={(e) => setDraft((v) => ({ ...v, limit: Number(e.target.value) }))} className="rounded-panel border border-line px-4 py-3"><option value={3}>3 per page</option><option value={6}>6 per page</option><option value={10}>10 per page</option></select>
        <button className="inline-flex items-center justify-center gap-2 rounded-panel bg-accent px-5 py-3 font-semibold text-accent-fg hover:bg-accent"><Search size={17} />Search</button>
      </form>
      <div className="mt-8 flex items-center justify-between"><h2 className="text-2xl font-semibold text-fg">Destinations</h2><span className="text-sm text-muted">{pagination.total} results</span></div>
      {loading && <div className="flex min-h-64 items-center justify-center gap-2 text-muted"><LoaderCircle className="animate-spin" />Loading destinations...</div>}
      {error && <div className="mt-8 rounded-panel border border-line bg-bg p-5 text-fg">{error}</div>}
      {!loading && !error && items.length === 0 && <div className="mt-8 rounded-panel border border-line bg-surface p-8 text-center text-muted">No destinations match these filters.</div>}
      {!loading && !error && <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{items.map((item) => <DestinationCard key={item.id} destination={item} />)}</div>}
      {pagination.totalPages > 1 && <div className="mt-8 flex items-center justify-center gap-4"><button disabled={pagination.page <= 1} onClick={() => setQuery((v) => ({ ...v, page: (v.page ?? 1) - 1 }))} className="rounded-full border bg-surface px-4 py-2 disabled:opacity-40">Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button disabled={pagination.page >= pagination.totalPages} onClick={() => setQuery((v) => ({ ...v, page: (v.page ?? 1) + 1 }))} className="rounded-full border bg-surface px-4 py-2 disabled:opacity-40">Next</button></div>}
    </section>
  </main>;
}

export default DestinationsLive;
