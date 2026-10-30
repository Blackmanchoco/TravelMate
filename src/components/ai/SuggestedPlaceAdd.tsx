import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getItinerary, updateItinerary } from "../../api/itineraries.api";
import type { AIChatResponse } from "../../api/ai.api";
import { ApiError } from "../../lib/api-client";
import { allowedItineraryDays, positionForChoice, suggestedPosition, type AddTimeSlot } from "../../lib/itinerary-add-position";
import type { ItineraryDetail, ItineraryItem, ItinerarySummary } from "../../types/itinerary";

type PlaceSuggestion = AIChatResponse["suggestedPlaces"][number];

const slots: AddTimeSlot[] = ["Morning", "Afternoon", "Evening"];

export function SuggestedPlaceAdd({ place, itineraries, activeItinerary, onAdd, onRefresh }: {
  place: PlaceSuggestion;
  itineraries: ItinerarySummary[];
  activeItinerary: ItineraryDetail | null;
  onAdd: (placeId: number, itineraryId: number, day: number, slot: AddTimeSlot) => Promise<ItineraryItem>;
  onRefresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(activeItinerary?.id ?? itineraries[0]?.id ?? null);
  const [detail, setDetail] = useState<ItineraryDetail | null>(activeItinerary);
  const [day, setDay] = useState(1);
  const [slot, setSlot] = useState<AddTimeSlot>(place.suggestedSlot ?? "Morning");
  const [confirmOccupied, setConfirmOccupied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open || selectedId === null) return;
    let cancelled = false;
    if (activeItinerary?.id === selectedId) {
      setDetail(activeItinerary);
      return;
    }
    setDetail(null);
    void getItinerary(selectedId)
      .then((result) => { if (!cancelled) setDetail(result); })
      .catch((caught: unknown) => { if (!cancelled) setError(caught instanceof ApiError ? caught.message : "The itinerary could not be loaded."); });
    return () => { cancelled = true; };
  }, [activeItinerary, open, selectedId]);

  const days = useMemo(() => detail
    ? allowedItineraryDays(detail.startDate, detail.endDate, detail.items.map((item) => item.day)) : [], [detail]);
  useEffect(() => {
    if (!detail) return;
    const position = suggestedPosition(detail.items, days, place.suggestedSlot);
    setDay(position.day);
    setSlot(position.timeSlot);
    setConfirmOccupied(false);
  }, [detail, days, place.suggestedSlot]);

  const position = detail ? positionForChoice(detail.items, day, slot) : null;
  const occurrences = detail?.items.filter((item) => item.placeId === place.placeId) ?? [];
  const activeOccurrences = activeItinerary?.items.filter((item) => item.placeId === place.placeId) ?? [];
  const full = detail && days.every((availableDay) => slots.every((availableSlot) =>
    detail.items.some((item) => item.day === availableDay && item.timeSlot === availableSlot)));

  const handleAdd = async () => {
    if (!detail || selectedId === null || !days.includes(day) || !position) return;
    if (position.occupied && !confirmOccupied) { setConfirmOccupied(true); return; }
    setBusy(true);
    setError(null);
    try {
      const item = await onAdd(place.placeId, selectedId, day, slot);
      setDetail((current) => current ? { ...current, items: [...current.items, item] } : current);
      setSuccess(`Added to Day ${item.day} ${item.timeSlot}, position ${item.order}.`);
      setConfirmOccupied(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The place could not be added.");
    } finally {
      setBusy(false);
    }
  };

  const handleExtend = async () => {
    if (!detail?.endDate || selectedId === null) return;
    setBusy(true);
    setError(null);
    try {
      const next = new Date(detail.endDate);
      next.setUTCDate(next.getUTCDate() + 1);
      const updated = await updateItinerary(selectedId, { endDate: next.toISOString().slice(0, 10) });
      setDetail(updated);
      await onRefresh();
      setSuccess("End date extended by one day. Choose a day and slot to add the place.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The end date could not be extended.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="rounded-control border border-line bg-bg p-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="font-medium text-fg">{place.name} <span className="text-xs font-normal text-muted">({place.category})</span></span>
      <button type="button" aria-label={`Add ${place.name} to itinerary`} aria-expanded={open}
        onClick={() => { setOpen((current) => !current); setError(null); setSuccess(null); }}
        className="rounded-control bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg">Add...</button>
    </div>
    {activeOccurrences.length > 0 && <p className="mt-1 text-xs text-muted">Already in active itinerary: {activeOccurrences.map((item) => `Day ${item.day} ${item.timeSlot}`).join(", ")}</p>}
    {open && <div role="dialog" aria-label={`Add ${place.name}`} className="mt-3 space-y-3 border-t border-line pt-3 text-xs">
      {itineraries.length === 0 ? <p>Create an itinerary first. <Link to="/itinerary" className="font-semibold text-accent underline">Open itineraries</Link></p> : <>
        <label className="block font-semibold text-fg">Itinerary<select aria-label={`Itinerary for ${place.name}`} value={selectedId ?? ""}
          onChange={(event) => { setSelectedId(Number(event.target.value)); setError(null); setSuccess(null); }} className="mt-1 w-full rounded-control border border-line bg-surface p-2 text-fg">
          {itineraries.map((itinerary) => <option key={itinerary.id} value={itinerary.id}>{itinerary.title}</option>)}
        </select></label>
        {!detail ? <p role="status">Loading itinerary...</p> : <>
          {occurrences.length > 0 && <p className="text-muted">Already in this itinerary: {occurrences.map((item) => `Day ${item.day} ${item.timeSlot} (position ${item.order})`).join(", ")}</p>}
          <p className="font-medium text-accent">Suggested: {place.suggestedSlot ?? suggestedPosition(detail.items, days, null).timeSlot}</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="font-semibold text-fg">Day<select aria-label={`Day for ${place.name}`} value={day} onChange={(event) => { setDay(Number(event.target.value)); setConfirmOccupied(false); }} className="mt-1 w-full rounded-control border border-line bg-surface p-2 text-fg">
              {days.map((availableDay) => <option key={availableDay} value={availableDay}>Day {availableDay}</option>)}
            </select></label>
            <label className="font-semibold text-fg">Slot<select aria-label={`Slot for ${place.name}`} value={slot} onChange={(event) => { setSlot(event.target.value as AddTimeSlot); setConfirmOccupied(false); }} className="mt-1 w-full rounded-control border border-line bg-surface p-2 text-fg">
              {slots.map((availableSlot) => <option key={availableSlot}>{availableSlot}</option>)}
            </select></label>
          </div>
          {position?.occupied && <p className="text-muted">Day {day} {slot} has stops. The new place will be position {position.order} in that slot.</p>}
          {confirmOccupied && <p role="alert" className="rounded-control border border-line bg-surface p-2">Confirm adding another stop to Day {day} {slot} at position {position?.order}.</p>}
          {full && detail.startDate && detail.endDate && <button type="button" onClick={() => void handleExtend()} disabled={busy} className="font-semibold text-accent underline">Extend end date by one day</button>}
          {(!detail.startDate || !detail.endDate) && <p className="text-muted">Dates are missing. Days 1–{days.length} are offered. <Link to="/itinerary" className="font-semibold text-accent underline">Set or extend dates</Link> for a dated schedule.</p>}
          <button type="button" onClick={() => void handleAdd()} disabled={busy || days.length === 0} className="rounded-control bg-accent px-3 py-2 font-semibold text-accent-fg disabled:opacity-50">{busy ? "Saving..." : confirmOccupied ? "Confirm add" : "Add to selected slot"}</button>
        </>}
      </>}
      {error && <p role="alert" className="text-fg">{error}</p>}
      {success && <p role="status" className="text-accent">{success}</p>}
    </div>}
  </div>;
}
