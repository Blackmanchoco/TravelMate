import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, LoaderCircle, MapPin, Pencil, Plus, Trash2, Wallet2 } from "lucide-react";
import { Link } from "react-router-dom";

import { DaySection } from "../components/itinerary/DaySection";
import { getItineraryWeather } from "../api/itineraries.api";
import { BudgetAlertCard } from "../components/itinerary/BudgetAlertCard";
import { PreferenceMatchCard } from "../components/itinerary/PreferenceMatchCard";
import { useItinerary } from "../context/ItineraryContext";
import { ApiError } from "../lib/api-client";
import { allowedItineraryDays } from "../lib/itinerary-add-position";
import type { CreateItineraryInput, ItineraryDetail, UpdateItineraryInput } from "../types/itinerary";
import type { ItineraryWeather } from "../types/itinerary-weather";

const InternalMap = lazy(() => import("../components/itinerary/InternalMap").then((module) => ({ default: module.InternalMap })));

const timeSlotOrder = { Morning: 0, Afternoon: 1, Evening: 2 } as const;

function InternalMapFallback() {
  return <section className="flex min-h-[360px] items-center justify-center rounded-panel border border-line bg-surface text-sm font-medium text-muted shadow-panel" role="status">Loading map...</section>;
}

interface ItineraryFormValue {
  title: string;
  startDate: string;
  endDate: string;
  budget: string;
}

const emptyForm: ItineraryFormValue = { title: "", startDate: "", endDate: "", budget: "" };

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formFromItinerary(itinerary: ItineraryDetail): ItineraryFormValue {
  return {
    title: itinerary.title,
    startDate: dateInputValue(itinerary.startDate),
    endDate: dateInputValue(itinerary.endDate),
    budget: itinerary.budget === null ? "" : String(itinerary.budget),
  };
}

function buildInput(value: ItineraryFormValue, destinationId: number | null = null): CreateItineraryInput {
  return {
    title: value.title.trim(),
    startDate: value.startDate || null,
    endDate: value.endDate || null,
    budget: value.budget === "" ? null : Number(value.budget),
    destinationId,
  };
}

function validateForm(value: ItineraryFormValue) {
  if (!value.title.trim()) return "Title is required.";
  if (value.startDate && value.endDate && value.endDate < value.startDate) return "End date cannot be before start date.";
  if (value.budget !== "" && (!Number.isFinite(Number(value.budget)) || Number(value.budget) < 0)) return "Budget must be zero or greater.";
  return null;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function ItineraryForm({
  heading,
  initialValue,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  heading: string;
  initialValue: ItineraryFormValue;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (value: ItineraryFormValue) => Promise<void>;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => setValue(initialValue), [initialValue]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateForm(value);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    try {
      await onSubmit(value);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "The itinerary could not be saved.");
    }
  };

  return <section className="rounded-panel border border-line bg-surface p-6 shadow-panel">
    <h2 className="text-2xl font-semibold text-fg">{heading}</h2>
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 grid gap-5 sm:grid-cols-2">
      <label className="sm:col-span-2"><span className="text-sm font-semibold text-fg">Title *</span><input value={value.title} onChange={(event) => setValue((current) => ({ ...current, title: event.target.value }))} maxLength={150} className="mt-2 w-full rounded-panel border border-line px-4 py-3 outline-none focus:border-accent" placeholder="e.g. Penang weekend" /></label>
      <label><span className="text-sm font-semibold text-fg">Start date</span><input type="date" value={value.startDate} onChange={(event) => setValue((current) => ({ ...current, startDate: event.target.value }))} className="mt-2 w-full rounded-panel border border-line px-4 py-3 outline-none focus:border-accent" /></label>
      <label><span className="text-sm font-semibold text-fg">End date</span><input type="date" value={value.endDate} onChange={(event) => setValue((current) => ({ ...current, endDate: event.target.value }))} className="mt-2 w-full rounded-panel border border-line px-4 py-3 outline-none focus:border-accent" /></label>
      <label className="sm:col-span-2"><span className="text-sm font-semibold text-fg">Budget (MYR)</span><input type="number" min="0" step="0.01" value={value.budget} onChange={(event) => setValue((current) => ({ ...current, budget: event.target.value }))} className="mt-2 w-full rounded-panel border border-line px-4 py-3 outline-none focus:border-accent" placeholder="Optional" /></label>
      {formError && <p role="alert" className="sm:col-span-2 rounded-panel bg-bg p-4 text-sm text-fg">{formError}</p>}
      <div className="flex flex-wrap gap-3 sm:col-span-2"><button type="submit" disabled={isSubmitting} className="rounded-full bg-fg px-5 py-3 text-sm font-semibold text-accent-fg disabled:cursor-wait disabled:opacity-60">{isSubmitting ? "Saving..." : submitLabel}</button>{onCancel && <button type="button" onClick={onCancel} disabled={isSubmitting} className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-fg">Cancel</button>}</div>
    </form>
  </section>;
}

function Itinerary() {
  const {
    itineraries,
    activeItineraryId,
    activeItinerary,
    isLoading,
    isActiveLoading,
    loadError,
    mutationError,
    pendingMutation,
    refreshItineraries,
    selectItinerary,
    createItinerary,
    updateActiveItinerary,
    deleteActiveItinerary,
    updateItem,
    removeItem,
    clearItems,
    isUpdatingItem,
    isRemovingItem,
    isClearingItems,
    clearMutationError,
  } = useItinerary();
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showClearItems, setShowClearItems] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [weather, setWeather] = useState<ItineraryWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    if (!activeItinerary || activeItinerary.items.length === 0) {
      setWeather(null);
      setWeatherLoading(false);
      return;
    }
    const controller = new AbortController();
    setWeather(null);
    setWeatherLoading(true);
    void getItineraryWeather(activeItinerary.id, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setWeather(result); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) setWeather(null);
      })
      .finally(() => { if (!controller.signal.aborted) setWeatherLoading(false); });
    return () => controller.abort();
  }, [activeItinerary]);

  const handleCreate = async (value: ItineraryFormValue) => {
    await createItinerary(buildInput(value));
    setShowCreate(false);
    setShowEdit(false);
    setSuccessMessage("Itinerary created successfully.");
  };

  const handleUpdate = async (value: ItineraryFormValue) => {
    const input: UpdateItineraryInput = buildInput(value, activeItinerary?.destinationId ?? null);
    await updateActiveItinerary(input);
    setShowEdit(false);
    setSuccessMessage("Itinerary updated successfully.");
  };

  const handleDelete = async () => {
    try {
      await deleteActiveItinerary();
      setShowDelete(false);
      setShowEdit(false);
      setSuccessMessage("Itinerary deleted successfully.");
    } catch {
      // The context exposes the API error below the active itinerary card.
    }
  };

  const handleClearItems = async () => {
    try {
      await clearItems();
      setShowClearItems(false);
      setSuccessMessage("All itinerary places were removed. The itinerary itself was kept.");
    } catch {
      setShowClearItems(false);
    }
  };

  const sortedItems = useMemo(() => [...(activeItinerary?.items ?? [])].sort((left, right) =>
    left.day - right.day ||
    timeSlotOrder[left.timeSlot] - timeSlotOrder[right.timeSlot] ||
    left.order - right.order ||
    left.id - right.id), [activeItinerary?.items]);

  const dayEntries = useMemo(() => {
    const groups = new Map<number, typeof sortedItems>();
    for (const item of sortedItems) groups.set(item.day, [...(groups.get(item.day) ?? []), item]);
    return [...groups.entries()].sort(([left], [right]) => left - right);
  }, [sortedItems]);
  const outOfRangeDays = useMemo(() => {
    if (!activeItinerary?.startDate || !activeItinerary.endDate) return [];
    const lastDay = allowedItineraryDays(activeItinerary.startDate, activeItinerary.endDate, []).length;
    return [...new Set(activeItinerary.items.filter((item) => item.day > lastDay).map((item) => item.day))].sort((a, b) => a - b);
  }, [activeItinerary]);

  if (isLoading && itineraries.length === 0) return <main className="flex min-h-[70vh] items-center justify-center bg-bg"><p className="flex items-center gap-2 text-muted"><LoaderCircle className="animate-spin" size={18} />Loading itineraries...</p></main>;
  if (loadError && itineraries.length === 0) return <main className="flex min-h-[70vh] items-center justify-center bg-bg px-4"><div className="max-w-lg rounded-panel border bg-surface p-8 text-center shadow-panel"><h1 className="text-2xl font-semibold">Unable to load itineraries</h1><p className="mt-3 text-muted">{loadError.message}</p><button type="button" onClick={() => void refreshItineraries()} className="mt-6 rounded-full bg-fg px-5 py-3 text-sm font-semibold text-accent-fg">Try again</button></div></main>;

  const shouldShowCreate = itineraries.length === 0 || showCreate;

  return <main className="min-h-screen bg-bg">
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">My itineraries</p><h1 className="mt-2 text-4xl font-semibold tracking-tight text-fg">Plan your next trip</h1><p className="mt-3 text-muted">Manage itinerary details, visit order, and the visit-order map from live server data.</p></div><button type="button" onClick={() => { clearMutationError(); setSuccessMessage(null); setShowCreate(true); setShowEdit(false); }} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-fg"><Plus size={17} />New itinerary</button></div>

      {itineraries.length > 0 && <section className="mt-8 rounded-panel border border-line bg-surface p-6 shadow-panel"><label className="block text-sm font-semibold text-fg" htmlFor="active-itinerary">Active itinerary</label><select id="active-itinerary" value={activeItineraryId ?? ""} onChange={(event) => { setShowEdit(false); setSuccessMessage(null); void selectItinerary(Number(event.target.value)); }} disabled={isActiveLoading || pendingMutation !== null} className="mt-2 w-full rounded-panel border border-line bg-surface px-4 py-3 text-fg outline-none focus:border-accent">{itineraries.map((itinerary) => <option key={itinerary.id} value={itinerary.id}>{itinerary.title}</option>)}</select></section>}

      {successMessage && <p role="status" className="mt-6 rounded-panel bg-tint p-4 text-sm text-accent">{successMessage}</p>}
      {mutationError && mutationError.code !== "ITINERARY_ITEM_SCHEDULE_CONFLICT" && <div role="alert" className="mt-6 flex items-center justify-between gap-4 rounded-panel bg-bg p-4 text-sm text-fg"><span>{mutationError.message}</span><button type="button" onClick={clearMutationError} className="font-semibold">Dismiss</button></div>}

      {shouldShowCreate && <div className="mt-8"><ItineraryForm heading={itineraries.length === 0 ? "Create your first itinerary" : "Create a new itinerary"} initialValue={emptyForm} submitLabel="Create itinerary" isSubmitting={pendingMutation === "create"} onSubmit={handleCreate} onCancel={itineraries.length > 0 ? () => setShowCreate(false) : undefined} /></div>}

      {!shouldShowCreate && isActiveLoading && <div className="mt-8 flex items-center justify-center rounded-panel border bg-surface p-12 text-muted"><LoaderCircle className="mr-2 animate-spin" size={18} />Loading active itinerary...</div>}

      {!shouldShowCreate && !isActiveLoading && activeItinerary && <div className="mt-8 space-y-6">
        <section className="rounded-panel border border-line bg-surface p-7 shadow-panel sm:p-9"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-3xl font-semibold text-fg">{activeItinerary.title}</h2><span className="rounded-full bg-tint px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">{activeItinerary.status}</span></div><p className="mt-3 text-sm text-muted">Itinerary #{activeItinerary.id}{activeItinerary.destination ? ` · ${activeItinerary.destination.name}` : " · Multiple destinations"}</p></div><div className="flex flex-wrap gap-3"><Link to={`/itineraries/${activeItinerary.id}/print`} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-fg">Print / Save as PDF</Link><button type="button" onClick={() => { setShowEdit(true); setSuccessMessage(null); clearMutationError(); }} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-fg"><Pencil size={15} />Edit</button><button type="button" onClick={() => setShowDelete(true)} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-fg"><Trash2 size={15} />Delete</button></div></div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3"><div className="rounded-panel bg-bg p-4"><p className="flex items-center gap-2 text-sm font-semibold text-muted"><CalendarDays size={16} />Start date</p><p className="mt-2 font-semibold text-fg">{formatDate(activeItinerary.startDate)}</p></div><div className="rounded-panel bg-bg p-4"><p className="flex items-center gap-2 text-sm font-semibold text-muted"><CalendarDays size={16} />End date</p><p className="mt-2 font-semibold text-fg">{formatDate(activeItinerary.endDate)}</p></div><div className="rounded-panel bg-bg p-4"><p className="flex items-center gap-2 text-sm font-semibold text-muted"><Wallet2 size={16} />Budget</p><p className="mt-2 font-semibold text-fg">{activeItinerary.budget === null ? "Not set" : `RM ${activeItinerary.budget.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p></div></div>
          <div className="mt-6 rounded-panel border border-line bg-bg p-5 text-sm text-muted">{activeItinerary.items.length} {activeItinerary.items.length === 1 ? "place" : "places"} currently scheduled from live itinerary data.</div>
        </section>
        <PreferenceMatchCard itineraryId={activeItinerary.id} items={activeItinerary.items} />
        <BudgetAlertCard itineraryId={activeItinerary.id} budget={activeItinerary.budget} items={activeItinerary.items} />
        {outOfRangeDays.length > 0 && <p role="alert" className="rounded-panel border border-line bg-tint p-4 text-sm text-fg">Repair needed: scheduled items on {outOfRangeDays.map((day) => `Day ${day}`).join(", ")} fall outside the itinerary date span. They remain visible. Extend the end date or move those items into range.</p>}
        {showEdit && <ItineraryForm key={activeItinerary.id} heading="Edit itinerary" initialValue={formFromItinerary(activeItinerary)} submitLabel="Save changes" isSubmitting={pendingMutation === "update"} onSubmit={handleUpdate} onCancel={() => setShowEdit(false)} />}
        <section className="flex flex-col gap-4 rounded-panel border border-line bg-surface p-6 shadow-panel sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Itinerary places</p><h2 className="mt-2 text-2xl font-semibold text-fg">Schedule and visit order</h2></div>{sortedItems.length > 0 && <button type="button" onClick={() => { clearMutationError(); setSuccessMessage(null); setShowClearItems(true); }} className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-bg px-4 py-2.5 text-sm font-semibold text-fg"><Trash2 size={16} />Clear all places</button>}</section>
        {sortedItems.length === 0 ? <section className="rounded-panel border border-dashed border-line bg-surface p-10 text-center"><MapPin className="mx-auto text-muted" size={30} /><h2 className="mt-4 text-xl font-semibold text-fg">No places scheduled</h2><p className="mt-2 text-sm text-muted">Add places from a place detail page, Saved Places, or a confirmed AI recommendation.</p></section> : <>
          <Suspense fallback={<InternalMapFallback />}><InternalMap items={sortedItems} /></Suspense>
          <div className="space-y-6">{dayEntries.map(([dayNumber, items]) => <DaySection key={dayNumber} dayNumber={dayNumber} items={items} weather={weather?.days.find((day) => day.dayNumber === dayNumber)} weatherLoading={weatherLoading} onRemove={removeItem} onUpdate={updateItem} isRemoving={isRemovingItem} isUpdating={isUpdatingItem} />)}</div>
        </>}
      </div>}
    </div>

    {showDelete && activeItinerary && <div role="dialog" aria-modal="true" aria-labelledby="delete-itinerary-title" className="fixed inset-0 z-[1000] flex items-center justify-center bg-fg/50 p-4"><div className="w-full max-w-md rounded-panel bg-surface p-7 shadow-panel"><h2 id="delete-itinerary-title" className="text-2xl font-semibold text-fg">Delete itinerary?</h2><p className="mt-3 text-muted">This permanently deletes “{activeItinerary.title}” and all of its itinerary items.</p><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setShowDelete(false)} disabled={pendingMutation === "delete"} className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="button" onClick={() => void handleDelete()} disabled={pendingMutation === "delete"} className="rounded-full bg-fg px-4 py-2.5 text-sm font-semibold text-accent-fg disabled:cursor-wait disabled:opacity-60">{pendingMutation === "delete" ? "Deleting..." : "Delete itinerary"}</button></div></div></div>}
    {showClearItems && activeItinerary && <div role="dialog" aria-modal="true" aria-labelledby="clear-items-title" className="fixed inset-0 z-[1000] flex items-center justify-center bg-fg/50 p-4"><div className="w-full max-w-md rounded-panel bg-surface p-7 shadow-panel"><h2 id="clear-items-title" className="text-2xl font-semibold text-fg">Clear all places?</h2><p className="mt-3 text-muted">This removes all {activeItinerary.items.length} scheduled items from “{activeItinerary.title}”. The itinerary itself will remain.</p><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setShowClearItems(false)} disabled={isClearingItems} className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="button" onClick={() => void handleClearItems()} disabled={isClearingItems} className="rounded-full bg-fg px-4 py-2.5 text-sm font-semibold text-accent-fg disabled:cursor-wait disabled:opacity-60">{isClearingItems ? "Clearing..." : "Clear all places"}</button></div></div></div>}
  </main>;
}

export default Itinerary;
