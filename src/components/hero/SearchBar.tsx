import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Landmark, Leaf, LoaderCircle, MapPin, Search, Theater, Utensils } from "lucide-react";
import { Link } from "react-router-dom";
import { searchCatalogue, type CatalogueResult } from "./catalogue-search";

const interests = [
  { label: "Culture", category: "Culture", icon: Theater },
  { label: "Nature", category: "Nature", icon: Leaf },
  { label: "Food", category: "Restaurant", icon: Utensils },
  { label: "History", category: "Historical", icon: Landmark },
];

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [result, setResult] = useState<CatalogueResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function runSearch(nextCategory = category) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError("");
    setResult(null);
    if (!query.trim() && !nextCategory) {
      setLoading(false);
      setError("Enter a destination or place name, or choose an interest.");
      return;
    }
    setLoading(true);
    try {
      const next = await searchCatalogue(query, nextCategory, controller.signal);
      if (!controller.signal.aborted) setResult(next);
    } catch {
      if (!controller.signal.aborted) setError("Could not load search results. Please try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void runSearch(); }
  const hasResults = result && (result.destinations.length > 0 || result.places.length > 0);
  return <div className="mt-8 w-full max-w-2xl">
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-panel border border-line bg-surface p-2 shadow-panel sm:flex-row" role="search" aria-label="Search the TravelMate catalogue">
      <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
        <Search size={20} className="shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-left"><label htmlFor="hero-search" className="text-xs font-semibold text-muted">Destination or place</label>
          <input id="hero-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try Kuala Lumpur or Petronas" autoComplete="off" maxLength={200} className="mt-1 w-full border-0 bg-transparent py-1 text-base text-fg" aria-controls="hero-search-results" />
        </div>
      </div>
      <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-accent px-6 py-3 text-sm font-semibold text-accent-fg" aria-busy={loading}>{loading ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}Search</button>
    </form>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Search by interest">
      {interests.map(interest => { const Icon = interest.icon; const selected = category === interest.category; return <button key={interest.category} type="button" aria-pressed={selected} className={`identity-chip inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${selected ? "border-accent bg-tint text-fg" : "border-surface/40 bg-fg/55 text-accent-fg hover:bg-fg/75"}`} onClick={() => { const next = selected ? "" : interest.category; setCategory(next); void runSearch(next); }}><Icon size={16} aria-hidden="true" />{interest.label}</button>; })}
    </div>
    <div id="hero-search-results" aria-live="polite" aria-busy={loading} className={(loading || error || result) ? "mt-4 rounded-panel border border-line bg-surface p-4 text-left text-fg shadow-panel" : ""}>
      {loading && <p role="status" className="text-sm text-muted">Searching the live catalogue...</p>}
      {error && <p role="alert" className="text-sm text-fg">{error}</p>}
      {result && !hasResults && <p className="text-sm text-muted">No matching destinations or places. Try another name or interest.</p>}
      {hasResults && <div className="grid gap-5 sm:grid-cols-2">
        {result.destinations.length > 0 && <div><h2 className="text-base font-semibold">Destinations</h2><ul className="mt-2 space-y-1">{result.destinations.map(item => <li key={item.id}><Link to={`/destinations/${item.id}`} className="flex min-h-10 items-center gap-2 rounded-control px-2 py-2 text-sm text-accent hover:bg-tint"><MapPin size={15} className="shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{item.name}</span><ArrowUpRight size={15} className="ml-auto shrink-0" aria-hidden="true" /></Link></li>)}</ul></div>}
        {result.places.length > 0 && <div><h2 className="text-base font-semibold">Places</h2><ul className="mt-2 space-y-1">{result.places.map(item => <li key={item.id}><Link to={`/destinations/${item.destinationId}/places/${item.id}`} className="flex min-h-10 items-center gap-2 rounded-control px-2 py-2 text-sm text-accent hover:bg-tint"><span className="min-w-0 break-words">{item.name}</span><ArrowUpRight size={15} className="ml-auto shrink-0" aria-hidden="true" /></Link></li>)}</ul>{result.placeTotal > result.places.length && <p className="mt-2 text-xs text-muted">Showing {result.places.length} of {result.placeTotal} matching places.</p>}</div>}
      </div>}
    </div>
  </div>;
}
