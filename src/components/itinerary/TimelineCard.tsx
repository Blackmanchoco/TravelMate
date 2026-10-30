import LocalPhoto from "../common/LocalPhoto";
import { useState, type FormEvent } from "react";
import { Clock3, MapPin, Pencil, Star, Trash2 } from "lucide-react";

import { ApiError } from "../../lib/api-client";
import type { ItineraryItem, UpdateItineraryItemInput } from "../../types/itinerary";

interface TimelineCardProps {
  item: ItineraryItem;
  showPosition: boolean;
  onRemove: (itemId: number) => Promise<void>;
  onUpdate: (itemId: number, input: UpdateItineraryItemInput) => Promise<ItineraryItem>;
  isRemoving: boolean;
  isUpdating: boolean;
}

const slotStyles: Record<ItineraryItem["timeSlot"], string> = {
  Morning: "bg-bg text-fg",
  Afternoon: "bg-tint text-accent",
  Evening: "bg-tint text-accent",
};

export function TimelineCard({ item, showPosition, onRemove, onUpdate, isRemoving, isUpdating }: TimelineCardProps) {
  const [editing, setEditing] = useState(false);
  const [day, setDay] = useState(String(item.day));
  const [timeSlot, setTimeSlot] = useState<ItineraryItem["timeSlot"]>(item.timeSlot);
  const [order, setOrder] = useState(String(item.order));
  const [itemError, setItemError] = useState<string | null>(null);
  const details = item.place;

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault();
    setItemError(null);
    const nextDay = Number(day);
    const nextOrder = Number(order);
    if (!Number.isInteger(nextDay) || nextDay < 1 || !Number.isInteger(nextOrder) || nextOrder < 1) {
      setItemError("Day and order must be positive whole numbers.");
      return;
    }
    try {
      await onUpdate(item.id, { day: nextDay, timeSlot, order: nextOrder });
      setEditing(false);
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : null;
      setItemError(error?.code === "ITINERARY_ITEM_SCHEDULE_CONFLICT" ? "That day, time slot, and order are already occupied." : error?.message ?? "The schedule could not be updated.");
    }
  };

  return <article className="relative overflow-hidden rounded-panel border border-line bg-surface shadow-panel" data-item-id={item.id}>
    <div className="absolute left-0 top-0 h-full w-1 bg-accent" />
    <div className="flex flex-col p-5 pl-6 sm:flex-row sm:items-start sm:gap-5"><div className="h-36 w-full shrink-0 overflow-hidden rounded-panel sm:w-36"><LocalPhoto src={details.imageUrl} alt={details.name} category={details.category} className="h-full w-full object-cover" /></div>
      <div className="mt-4 flex-1 sm:mt-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${slotStyles[item.timeSlot]}`}>{item.timeSlot}</span>{showPosition && <span className="rounded-full border border-line bg-bg px-3 py-1 text-xs font-semibold text-muted">Position in slot {item.order}</span>}</div>
        <div className="mt-4 flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-fg">{details.name}</h3><p className="mt-2 flex items-center gap-2 text-sm text-muted"><MapPin size={15} />{details.address ?? "Address unavailable"}</p></div><div className="flex gap-1"><button type="button" onClick={() => { setEditing((current) => !current); setItemError(null); }} aria-label={`Edit schedule for ${details.name}, day ${item.day}, ${item.timeSlot}, order ${item.order}`} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full p-2.5 text-muted transition hover:bg-tint hover:text-accent"><Pencil size={17} /></button><button type="button" onClick={() => void onRemove(item.id).catch((caught) => setItemError(caught instanceof ApiError ? caught.message : "The item could not be deleted."))} disabled={isRemoving} aria-label={`Remove ${details.name}, day ${item.day}, ${item.timeSlot}, order ${item.order}`} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full p-2.5 text-muted transition hover:bg-bg hover:text-muted disabled:cursor-wait disabled:opacity-50"><Trash2 size={17} /></button></div></div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted"><div className="inline-flex items-center gap-1.5 rounded-full bg-bg px-3 py-1.5 font-semibold text-fg"><Star size={14} className="fill-accent text-muted" />{details.rating?.toFixed(1) ?? "Not rated"}</div><div className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 font-medium text-muted"><Clock3 size={14} />{item.estimatedDuration ?? "Flexible duration"}</div></div>
        {editing && <form onSubmit={(event) => void handleUpdate(event)} className="mt-4 grid gap-3 rounded-panel border border-line bg-tint/50 p-4 sm:grid-cols-3"><label className="text-xs font-semibold text-muted">Day<input aria-label={`Day for item ${item.id}`} type="number" min="1" step="1" value={day} onChange={(event) => setDay(event.target.value)} className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-muted">Time slot<select aria-label={`Time slot for item ${item.id}`} value={timeSlot} onChange={(event) => setTimeSlot(event.target.value as ItineraryItem["timeSlot"])} className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm"><option>Morning</option><option>Afternoon</option><option>Evening</option></select></label><label className="text-xs font-semibold text-muted">Position in slot<input aria-label={`Position in slot for item ${item.id}`} type="number" min="1" step="1" value={order} onChange={(event) => setOrder(event.target.value)} className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm" /></label><div className="flex gap-2 sm:col-span-3"><button type="submit" disabled={isUpdating} className="rounded-full bg-fg px-4 py-2 text-xs font-semibold text-accent-fg disabled:cursor-wait disabled:opacity-60">{isUpdating ? "Saving..." : "Save schedule"}</button><button type="button" onClick={() => { setEditing(false); setDay(String(item.day)); setTimeSlot(item.timeSlot); setOrder(String(item.order)); setItemError(null); }} className="rounded-full border border-line px-4 py-2 text-xs font-semibold">Cancel</button></div></form>}
        {isRemoving && <p role="status" className="mt-3 text-sm font-medium text-muted">Deleting item...</p>}
        {itemError && <p role="alert" className="mt-3 rounded-control bg-bg p-3 text-sm text-fg">{itemError}</p>}
      </div>
    </div>
  </article>;
}
