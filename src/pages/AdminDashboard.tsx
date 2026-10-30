import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { FormEvent, ReactNode } from "react";
import {
  Archive,
  CalendarRange,
  Database,
  Heart,
  MapPinned,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";

import {
  archiveAdminPlace,
  deleteAdminItinerary,
  getAdminStats,
  getCatalogReport,
  listAdminItineraries,
  listAdminPlaces,
  listAdminUsers,
  restoreAdminPlace,
} from "../api/admin.api";
import AdminPlaceForm from "../components/admin/AdminPlaceForm";
import type {
  AdminItinerary,
  AdminPlace,
  AdminStats,
  AdminUser,
  CatalogReport,
} from "../api/admin.api";
import { listDestinations } from "../api/destinations.api";
import { ApiError } from "../lib/api-client";
import type { Paginated, Pagination } from "../types/api";
import type { Destination } from "../types/destination";

type AdminSection = "overview" | "report" | "users" | "places" | "itineraries";

const PAGE_SIZE = 10;

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "The administrator data could not be loaded.";
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function PageState({
  loading,
  error,
  empty,
  emptyMessage,
  retry,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyMessage: string;
  retry: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex min-h-56 items-center justify-center text-sm font-medium text-muted">
        Loading real system data…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center px-4 text-center">
        <p className="font-semibold text-fg">Unable to load this section</p>
        <p className="mt-2 max-w-lg text-sm text-muted">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-fg px-4 py-2 text-sm font-semibold text-accent-fg"
        >
          <RefreshCw size={15} /> Retry
        </button>
      </div>
    );
  }
  if (empty) {
    return <div className="flex min-h-56 items-center justify-center text-sm text-muted">{emptyMessage}</div>;
  }
  return children;
}

function PaginationControls({
  pagination,
  onPage,
}: {
  pagination: Pagination | undefined;
  onPage: (page: number) => void;
}) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 text-sm">
      <span className="text-muted">
        Page {pagination.page} of {pagination.totalPages} · {pagination.total} results
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPage(pagination.page - 1)}
          className="rounded-full border border-line px-4 py-2 font-semibold text-fg disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPage(pagination.page + 1)}
          className="rounded-full border border-line px-4 py-2 font-semibold text-fg disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function SearchForm({
  value,
  onChange,
  onSubmit,
  placeholder,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap gap-3 border-b border-line p-5">
      <label className="flex min-w-64 flex-1 items-center gap-2 rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-muted">
        <Search size={16} />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-fg outline-none placeholder:text-muted"
        />
      </label>
      {children}
      <button type="submit" className="rounded-control bg-fg px-5 py-2.5 text-sm font-semibold text-accent-fg">
        Search
      </button>
    </form>
  );
}

function CatalogReportContent({ report }: { report: CatalogReport }) {
  const fields: Array<{ label: string; metric: keyof Omit<CatalogReport["completeness"], "total"> }> = [
    { label: "Price level", metric: "priceLevel" },
    { label: "Coordinates", metric: "coordinates" },
    { label: "Tags", metric: "tags" },
    { label: "Travel style tags", metric: "travelStyleTags" },
    { label: "Activity types", metric: "activityTypes" },
    { label: "Description", metric: "description" },
  ];
  const lists = [
    { title: "Most engaged", items: report.engagement.mostEngaged },
    { title: "Least engaged", items: report.engagement.leastEngaged },
  ];

  return (
    <div className="space-y-8 p-5 sm:p-7">
      <div>
        <h2 className="text-xl font-semibold text-fg">Catalog quality and coverage</h2>
        <Link to="/admin/report/print" className="mt-3 inline-block rounded-control border border-line px-4 py-2 font-semibold text-fg focus-visible:outline-2">Export PDF</Link>
        <p className="mt-1 text-sm text-muted">Live counts for public discovery. Test fixtures are listed separately.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Discoverable places", value: report.totals.discoverable },
            { label: "Archived places", value: report.totals.archived },
            { label: "Test fixtures", value: report.totals.test },
          ].map((item) => (
            <article key={item.label} className="rounded-panel border border-line bg-bg p-4">
              <p className="text-3xl font-semibold text-fg">{item.value}</p>
              <p className="mt-1 text-sm text-muted">{item.label}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="font-semibold text-fg">By destination</h3>
          <div className="mt-3 overflow-x-auto rounded-control border border-line">
            <table className="min-w-full text-left text-sm"><thead className="bg-bg text-muted"><tr><th className="px-4 py-3">Destination</th><th className="px-4 py-3">Discoverable</th><th className="px-4 py-3">Archived</th></tr></thead><tbody className="divide-y divide-line">{report.byDestination.map((row) => <tr key={row.destinationId}><td className="px-4 py-3 font-medium text-fg">{row.name}</td><td className="px-4 py-3">{row.discoverable}</td><td className="px-4 py-3">{row.archived}</td></tr>)}</tbody></table>
          </div>
        </section>
        <section>
          <h3 className="font-semibold text-fg">By category</h3>
          <div className="mt-3 overflow-x-auto rounded-control border border-line">
            <table className="min-w-full text-left text-sm"><thead className="bg-bg text-muted"><tr><th className="px-4 py-3">Category</th><th className="px-4 py-3">Discoverable</th></tr></thead><tbody className="divide-y divide-line">{report.byCategory.map((row) => <tr key={row.category}><td className="px-4 py-3 font-medium text-fg">{row.category}</td><td className="px-4 py-3">{row.count}</td></tr>)}</tbody></table>
          </div>
        </section>
      </div>

      <section>
        <h3 className="font-semibold text-fg">Field completeness</h3>
        <p className="mt-1 text-sm text-muted">Missing values among {report.completeness.total} discoverable places.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(({ label, metric }) => {
            const value = report.completeness[metric];
            return <div key={metric} className="rounded-control border border-line p-4"><p className="text-sm text-muted">{label}</p><p className="mt-2 text-lg font-semibold text-fg">{value.missing} missing <span className="text-sm font-normal text-muted">({(value.missingRatio * 100).toFixed(1)}%)</span></p></div>;
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {lists.map(({ title, items }) => (
          <section key={title}>
            <h3 className="font-semibold text-fg">{title}</h3>
            <p className="mt-1 text-sm text-muted">Saved places plus itinerary occurrences; ties use place ID.</p>
            <div className="mt-3 overflow-x-auto rounded-control border border-line">
              <table className="min-w-full text-left text-sm"><thead className="bg-bg text-muted"><tr><th className="px-4 py-3">Place</th><th className="px-4 py-3">Saved</th><th className="px-4 py-3">Items</th></tr></thead><tbody className="divide-y divide-line">{items.map((row) => <tr key={row.placeId}><td className="px-4 py-3"><p className="font-medium text-fg">{row.name}</p><p className="text-xs text-muted">{row.destination} · ID {row.placeId}</p></td><td className="px-4 py-3">{row.savedCount}</td><td className="px-4 py-3">{row.itineraryItemCount}</td></tr>)}</tbody></table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [section, setSection] = useState<AdminSection>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsRetry, setStatsRetry] = useState(0);

  const [report, setReport] = useState<CatalogReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportRetry, setReportRetry] = useState(0);

  const [users, setUsers] = useState<Paginated<AdminUser> | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userDraft, setUserDraft] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [usersRetry, setUsersRetry] = useState(0);

  const [places, setPlaces] = useState<Paginated<AdminPlace> | null>(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [placeDraft, setPlaceDraft] = useState("");
  const [placeSearch, setPlaceSearch] = useState("");
  const [placePage, setPlacePage] = useState(1);
  const [placeStatus, setPlaceStatus] = useState<"active" | "archived" | "all">("active");
  const [includeTest, setIncludeTest] = useState(false);
  const [placeCategory, setPlaceCategory] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [placesRetry, setPlacesRetry] = useState(0);
  const [pendingPlaceId, setPendingPlaceId] = useState<number | null>(null);
  const [placeActionErrors, setPlaceActionErrors] = useState<Record<number, string>>({});

  const [itineraries, setItineraries] = useState<Paginated<AdminItinerary> | null>(null);
  const [itinerariesLoading, setItinerariesLoading] = useState(false);
  const [itinerariesError, setItinerariesError] = useState<string | null>(null);
  const [itineraryDraft, setItineraryDraft] = useState("");
  const [itinerarySearch, setItinerarySearch] = useState("");
  const [itineraryPage, setItineraryPage] = useState(1);
  const [itinerariesRetry, setItinerariesRetry] = useState(0);
  const [pendingItineraryId, setPendingItineraryId] = useState<number | null>(null);
  const [itineraryActionErrors, setItineraryActionErrors] = useState<Record<number, string>>({});
  const [destinations, setDestinations] = useState<Destination[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setStatsLoading(true);
    setStatsError(null);
    void getAdminStats(controller.signal)
      .then(setStats)
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatsError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setStatsLoading(false);
      });
    return () => controller.abort();
  }, [statsRetry]);

  useEffect(() => {
    void listDestinations({ page: 1, limit: 100 })
      .then((result) => setDestinations(result.items))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (section !== "report") return;
    const controller = new AbortController();
    setReportLoading(true);
    setReportError(null);
    void getCatalogReport(controller.signal)
      .then(setReport)
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setReportError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setReportLoading(false);
      });
    return () => controller.abort();
  }, [reportRetry, section]);

  useEffect(() => {
    if (section !== "users") return;
    const controller = new AbortController();
    setUsersLoading(true);
    setUsersError(null);
    void listAdminUsers({ page: userPage, limit: PAGE_SIZE, search: userSearch }, controller.signal)
      .then(setUsers)
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setUsersError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setUsersLoading(false);
      });
    return () => controller.abort();
  }, [section, userPage, userSearch, usersRetry]);

  useEffect(() => {
    if (section !== "places") return;
    const controller = new AbortController();
    setPlacesLoading(true);
    setPlacesError(null);
    void listAdminPlaces(
      {
        page: placePage,
        limit: PAGE_SIZE,
        search: placeSearch,
        status: placeStatus,
        includeTest,
        category: placeCategory,
        destinationId: destinationId ? Number(destinationId) : undefined,
      },
      controller.signal,
    )
      .then(setPlaces)
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setPlacesError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlacesLoading(false);
      });
    return () => controller.abort();
  }, [destinationId, includeTest, placeCategory, placePage, placeSearch, placeStatus, placesRetry, section]);

  useEffect(() => {
    if (section !== "itineraries") return;
    const controller = new AbortController();
    setItinerariesLoading(true);
    setItinerariesError(null);
    void listAdminItineraries(
      { page: itineraryPage, limit: PAGE_SIZE, search: itinerarySearch },
      controller.signal,
    )
      .then(setItineraries)
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setItinerariesError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setItinerariesLoading(false);
      });
    return () => controller.abort();
  }, [itinerariesRetry, itineraryPage, itinerarySearch, section]);

  const submitUsers = useCallback((event: FormEvent) => {
    event.preventDefault();
    setUserPage(1);
    setUserSearch(userDraft.trim());
  }, [userDraft]);

  const submitPlaces = useCallback((event: FormEvent) => {
    event.preventDefault();
    setPlacePage(1);
    setPlaceSearch(placeDraft.trim());
  }, [placeDraft]);

  const submitItineraries = useCallback((event: FormEvent) => {
    event.preventDefault();
    setItineraryPage(1);
    setItinerarySearch(itineraryDraft.trim());
  }, [itineraryDraft]);

  const handleArchivePlace = useCallback(async (place: AdminPlace) => {
    const confirmed = window.confirm(
      `Archive “${place.name}”? It will leave public discovery and eligible recommendations. Existing saved places and itinerary history remain. Admin can restore it later.`,
    );
    if (!confirmed) return;

    setPendingPlaceId(place.id);
    setPlaceActionErrors((current) => {
      const next = { ...current };
      delete next[place.id];
      return next;
    });
    try {
      await archiveAdminPlace(place.id);
      setPlacesRetry((value) => value + 1);
      setStatsRetry((value) => value + 1);
      setReportRetry((value) => value + 1);
    } catch (error) {
      setPlaceActionErrors((current) => ({
        ...current,
        [place.id]: errorMessage(error),
      }));
    } finally {
      setPendingPlaceId(null);
    }
  }, []);

  const handleRestorePlace = useCallback(async (place: AdminPlace) => {
    if (!place.restorable) return;
    const confirmed = window.confirm(`Restore “${place.name}”? It will reappear in public discovery and eligible recommendations.`);
    if (!confirmed) return;
    setPendingPlaceId(place.id);
    setPlaceActionErrors((current) => { const next = { ...current }; delete next[place.id]; return next; });
    try {
      await restoreAdminPlace(place.id);
      setPlacesRetry((value) => value + 1);
      setStatsRetry((value) => value + 1);
      setReportRetry((value) => value + 1);
    } catch (error) {
      setPlaceActionErrors((current) => ({ ...current, [place.id]: errorMessage(error) }));
    } finally { setPendingPlaceId(null); }
  }, []);

  const handlePlaceCreated = useCallback((_id: number, name: string) => {
    setPlaceDraft(name);
    setPlaceSearch(name);
    setPlaceStatus("active");
    setPlacePage(1);
    setPlacesRetry((value) => value + 1);
    setStatsRetry((value) => value + 1);
    setReportRetry((value) => value + 1);
  }, []);

  const handleDeleteItinerary = useCallback(async (itinerary: AdminItinerary) => {
    const confirmed = window.confirm(
      `This will permanently delete the itinerary and all of its scheduled places. It cannot be recovered. Delete “${itinerary.title}”?`,
    );
    if (!confirmed) return;

    setPendingItineraryId(itinerary.id);
    setItineraryActionErrors((current) => {
      const next = { ...current };
      delete next[itinerary.id];
      return next;
    });
    try {
      await deleteAdminItinerary(itinerary.id);
      setItineraries((current) => current ? {
        items: current.items.filter((item) => item.id !== itinerary.id),
        pagination: {
          ...current.pagination,
          total: Math.max(0, current.pagination.total - 1),
          totalPages: Math.ceil(Math.max(0, current.pagination.total - 1) / current.pagination.limit),
        },
      } : current);
      setStatsRetry((value) => value + 1);
    } catch (error) {
      setItineraryActionErrors((current) => ({
        ...current,
        [itinerary.id]: errorMessage(error),
      }));
    } finally {
      setPendingItineraryId(null);
    }
  }, []);

  const tabs: Array<{ id: AdminSection; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "report", label: "Report" },
    { id: "users", label: "Users" },
    { id: "places", label: "Places" },
    { id: "itineraries", label: "Itineraries" },
  ];

  return (
    <main className="min-h-[80vh] bg-bg">
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-tint px-3 py-1.5 text-sm font-semibold text-accent">
          <ShieldCheck size={16} /> Administrator access
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">System administration</h1>
        <p className="mt-2 text-muted">Operational data and audited content controls from the TravelMate API.</p>

        <nav className="mt-8 flex gap-2 overflow-x-auto rounded-panel border border-line bg-surface p-2" aria-label="Admin sections">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setSection(tab.id)} className={`whitespace-nowrap rounded-control px-4 py-2.5 text-sm font-semibold transition ${section === tab.id ? "bg-fg text-accent-fg" : "text-muted hover:bg-bg"}`}>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="mt-6 overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
          {section === "overview" && (
            <PageState loading={statsLoading} error={statsError} empty={!stats} emptyMessage="No system statistics are available." retry={() => setStatsRetry((value) => value + 1)}>
              <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-5">
                {stats && [
                  { label: "Users", value: stats.users, icon: Users },
                  { label: "Destinations", value: stats.destinations, icon: MapPinned },
                  { label: "Active places", value: stats.activePlaces, icon: Database },
                  { label: "Itineraries", value: stats.itineraries, icon: CalendarRange },
                  { label: "Saved places", value: stats.savedPlaces, icon: Heart },
                ].map(({ label, value, icon: Icon }) => (
                  <article key={label} className="rounded-panel border border-line bg-bg p-5">
                    <Icon size={19} className="text-accent" />
                    <p className="mt-5 text-3xl font-semibold text-fg">{value}</p>
                    <p className="mt-1 text-sm text-muted">{label}</p>
                  </article>
                ))}
              </div>
            </PageState>
          )}

          {section === "report" && (
            <PageState loading={reportLoading} error={reportError} empty={!report || report.totals.discoverable === 0} emptyMessage="No discoverable places are available for this report." retry={() => setReportRetry((value) => value + 1)}>
              {report && <CatalogReportContent report={report} />}
            </PageState>
          )}

          {section === "users" && (
            <>
              <SearchForm value={userDraft} onChange={setUserDraft} onSubmit={submitUsers} placeholder="Search by name or email" />
              <PageState loading={usersLoading} error={usersError} empty={!users?.items.length} emptyMessage="No users match these filters." retry={() => setUsersRetry((value) => value + 1)}>
                <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-bg text-xs uppercase tracking-wide text-muted"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Registered</th><th className="px-5 py-3">Itineraries</th><th className="px-5 py-3">Saved places</th></tr></thead><tbody className="divide-y divide-line">{users?.items.map((user) => <tr key={user.id}><td className="px-5 py-4"><p className="font-semibold text-fg">{user.name}</p><p className="mt-1 text-muted">{user.email}</p></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.role === "admin" ? "bg-tint text-accent" : "bg-tint text-muted"}`}>{user.role}</span></td><td className="px-5 py-4 text-muted">{formatDate(user.createdAt)}</td><td className="px-5 py-4 text-muted">{user._count.itineraries}</td><td className="px-5 py-4 text-muted">{user._count.savedPlaces}</td></tr>)}</tbody></table></div>
                <PaginationControls pagination={users?.pagination} onPage={setUserPage} />
              </PageState>
            </>
          )}

          {section === "places" && (
            <>
              <AdminPlaceForm onCreated={handlePlaceCreated} />
              <SearchForm value={placeDraft} onChange={setPlaceDraft} onSubmit={submitPlaces} placeholder="Search place name, description or address">
                <input value={placeCategory} onChange={(event) => { setPlaceCategory(event.target.value); setPlacePage(1); }} placeholder="Category" className="rounded-control border border-line px-3 py-2.5 text-sm outline-none" />
                <select value={destinationId} onChange={(event) => { setDestinationId(event.target.value); setPlacePage(1); }} className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm"><option value="">All destinations</option>{destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}</select>
                <select value={placeStatus} onChange={(event) => { setPlaceStatus(event.target.value as "active" | "archived" | "all"); setPlacePage(1); }} className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm"><option value="active">Active</option><option value="archived">Archived</option><option value="all">All statuses</option></select>
                <label className="inline-flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={includeTest} onChange={(event) => { setIncludeTest(event.target.checked); setPlacePage(1); }} />Include Test fixtures</label>
              </SearchForm>
              <PageState loading={placesLoading} error={placesError} empty={!places?.items.length} emptyMessage="No places match these filters." retry={() => setPlacesRetry((value) => value + 1)}>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-bg text-xs uppercase tracking-wide text-muted">
                      <tr><th className="px-5 py-3">Place</th><th className="px-5 py-3">Destination</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">References</th><th className="px-5 py-3">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {places?.items.map((place) => {
                        const pending = pendingPlaceId === place.id;
                        return (
                          <tr key={place.id}>
                            <td className="px-5 py-4"><p className="font-semibold text-fg">{place.name}</p><p className="mt-1 text-xs text-muted">ID {place.id}</p></td>
                            <td className="px-5 py-4 text-muted">{place.destination.name}</td>
                            <td className="px-5 py-4 text-muted">{place.category}</td>
                            <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${place.deletedAt ? "bg-bg text-fg" : "bg-tint text-accent"}`}>{place.deletedAt ? "archived" : "active"}</span></td>
                            <td className="px-5 py-4 text-muted">{place._count.savedBy} saved · {place._count.itineraryItems} items</td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-2"><button
                                type="button"
                                disabled={pending || Boolean(place.deletedAt) || Boolean(place.restoreDisabledReason)}
                                onClick={() => void handleArchivePlace(place)}
                                className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-xs font-semibold text-fg disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Archive size={14} /> {pending ? "Working…" : place.deletedAt ? "Archived" : "Archive"}
                              </button>
                              {(place.deletedAt || place.restoreDisabledReason) && <button type="button" disabled={pending || !place.restorable} onClick={() => void handleRestorePlace(place)} title={place.restoreDisabledReason ?? undefined} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-xs font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-50">
                                <RotateCcw size={14} /> {pending ? "Working…" : "Restore"}
                              </button>}</div>
                              {!place.restorable && place.restoreDisabledReason && <p className="mt-1 max-w-48 text-xs text-muted">{place.restoreDisabledReason}</p>}
                              {placeActionErrors[place.id] && <p role="alert" className="mt-2 max-w-48 text-xs text-muted">{placeActionErrors[place.id]}</p>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <PaginationControls pagination={places?.pagination} onPage={setPlacePage} />
              </PageState>
            </>
          )}

          {section === "itineraries" && (
            <>
              <SearchForm value={itineraryDraft} onChange={setItineraryDraft} onSubmit={submitItineraries} placeholder="Search title, owner name or email" />
              <PageState loading={itinerariesLoading} error={itinerariesError} empty={!itineraries?.items.length} emptyMessage="No itineraries match this search." retry={() => setItinerariesRetry((value) => value + 1)}>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-bg text-xs uppercase tracking-wide text-muted">
                      <tr><th className="px-5 py-3">Itinerary</th><th className="px-5 py-3">Owner</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Dates</th><th className="px-5 py-3">Items</th><th className="px-5 py-3">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {itineraries?.items.map((itinerary) => {
                        const pending = pendingItineraryId === itinerary.id;
                        return (
                          <tr key={itinerary.id}>
                            <td className="px-5 py-4"><p className="font-semibold text-fg">{itinerary.title}</p><p className="mt-1 text-xs text-muted">ID {itinerary.id}{itinerary.destination ? ` · ${itinerary.destination.name}` : ""}</p></td>
                            <td className="px-5 py-4"><p className="text-fg">{itinerary.user.name}</p><p className="mt-1 text-xs text-muted">{itinerary.user.email}</p></td>
                            <td className="px-5 py-4"><span className="rounded-full bg-tint px-2.5 py-1 text-xs font-semibold text-accent">{itinerary.status}</span></td>
                            <td className="px-5 py-4 text-muted">{formatDate(itinerary.startDate)} – {formatDate(itinerary.endDate)}</td>
                            <td className="px-5 py-4 text-muted">{itinerary._count.items}</td>
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => void handleDeleteItinerary(itinerary)}
                                className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-xs font-semibold text-fg disabled:cursor-wait disabled:opacity-50"
                              >
                                <Trash2 size={14} /> {pending ? "Deleting…" : "Delete"}
                              </button>
                              {itineraryActionErrors[itinerary.id] && <p role="alert" className="mt-2 max-w-48 text-xs text-muted">{itineraryActionErrors[itinerary.id]}</p>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <PaginationControls pagination={itineraries?.pagination} onPage={setItineraryPage} />
              </PageState>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
