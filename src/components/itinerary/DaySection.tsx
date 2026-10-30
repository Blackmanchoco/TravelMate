import { CalendarDays, MapPin } from "lucide-react";

import type { ItineraryItem, UpdateItineraryItemInput } from "../../types/itinerary";
import type { ItineraryWeatherDay } from "../../types/itinerary-weather";
import { TimelineCard } from "./TimelineCard";

interface DaySectionProps {
  dayNumber: number;
  items: ItineraryItem[];
  onRemove: (itemId: number) => Promise<void>;
  onUpdate: (itemId: number, input: UpdateItineraryItemInput) => Promise<ItineraryItem>;
  isRemoving: (itemId: number) => boolean;
  isUpdating: (itemId: number) => boolean;
  weather?: ItineraryWeatherDay;
  weatherLoading: boolean;
}

const timeSlots: ItineraryItem["timeSlot"][] = ["Morning", "Afternoon", "Evening"];

export function DaySection({ dayNumber, items, onRemove, onUpdate, isRemoving, isUpdating, weather, weatherLoading }: DaySectionProps) {
  return <section className="rounded-panel border border-line bg-surface p-5 shadow-panel sm:p-7">
    <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-panel bg-tint text-accent"><CalendarDays size={20} /></div><div><h2 className="text-xl font-semibold text-fg">Day {dayNumber}</h2><p className="mt-1 text-sm text-muted">Scheduled places in visit order</p></div></div>
    <div className="mt-5 rounded-panel border border-line bg-tint p-4 text-sm text-fg" aria-label={`Weather for day ${dayNumber}`}>
      <p className="font-semibold text-accent">Daytime forecast{weather?.date ? ` · ${weather.date}` : ""}</p>
      {weatherLoading ? <p className="mt-1">Checking weather...</p>
        : !weather || weather.status === "unavailable" ? <p className="mt-1">Weather information is currently unavailable.</p>
          : weather.status === "no_date" ? <p className="mt-1">Set an itinerary start date to see this day's forecast.</p>
            : weather.status === "no_coordinates" ? <p className="mt-1">No place coordinates are available for this day's forecast.</p>
              : weather.status === "out_of_range" ? <p className="mt-1">No forecast is available for this date yet.</p>
                : weather.status === "available" ? <>
                  <p className="mt-1">{weather.condition} · {weather.tempMinC}–{weather.tempMaxC}°C · up to {weather.maxPrecipitationProbability}% chance of precipitation</p>
                  <p className="mt-1 text-xs text-muted">Near {weather.location?.sourcePlaceName ?? "the first stop"} · OpenWeatherMap 5-day forecast</p>
                  {weather.location?.multipleDestinations && <p className="mt-1 text-xs text-muted">This day spans multiple destinations; conditions at other stops may differ.</p>}
                  {weather.alertLevel && <p role="status" className="mt-3 rounded-control border border-line bg-bg p-3 font-medium text-fg">{weather.alertLevel === "severe" ? "Adverse weather" : "Rain"} may affect outdoor stops: {weather.outdoorPlaceNames.join(", ")}. Check conditions before travel; your itinerary has not been changed.</p>}
                </> : null}
    </div>
    <div className="mt-6 space-y-6">{timeSlots.map((slot, slotIndex) => {
      const slotItems = items.filter((item) => item.timeSlot === slot).sort((left, right) => left.order - right.order || left.id - right.id);
      if (slotItems.length === 0) return null;
      return <div key={`${dayNumber}-${slot}`} className="relative"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-fg text-sm font-semibold text-accent-fg">{slotIndex + 1}</div><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">{slot}</p><p className="mt-1 flex items-center gap-2 text-sm text-muted"><MapPin size={14} />{slotItems.length} {slotItems.length === 1 ? "stop" : "stops"}</p></div></div><div className="mt-4 ml-4 space-y-4 border-l border-dashed border-line pl-6">{slotItems.map((item) => <TimelineCard key={item.id} item={item} showPosition={slotItems.length > 1} onRemove={onRemove} onUpdate={onUpdate} isRemoving={isRemoving(item.id)} isUpdating={isUpdating(item.id)} />)}</div></div>;
    })}</div>
  </section>;
}
