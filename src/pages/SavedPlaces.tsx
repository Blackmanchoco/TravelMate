import LocalPhoto from "../components/common/LocalPhoto";
import { ArrowRight, Compass, HeartOff, MapPin, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useSavedPlaces } from "../context/SavedPlacesContext";
import { useItinerary } from "../context/ItineraryContext";
import { ApiError } from "../lib/api-client";

function SavedPlaces() {
  const {
    savedPlaces,
    pagination,
    isLoading,
    loadError,
    mutationError,
    refreshSavedPlaces,
    removePlace,
    isRemovingPlace,
    clearMutationError,
  } = useSavedPlaces();
  const { activeItineraryId, addPlace, getPlaceOccurrenceCount, isAddingPlace } = useItinerary();
  const [itineraryFeedback, setItineraryFeedback] = useState<Record<number, { message: string; needsItinerary: boolean }>>({});

  const handleAddToItinerary = async (placeId: number) => {
    if (activeItineraryId === null) {
      setItineraryFeedback((current) => ({ ...current, [placeId]: { message: "Create or select an itinerary first.", needsItinerary: true } }));
      return;
    }
    try {
      const item = await addPlace(placeId);
      setItineraryFeedback((current) => ({ ...current, [placeId]: { message: `Added to Day ${item.day} ${item.timeSlot} (order ${item.order}).`, needsItinerary: false } }));
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;
      setItineraryFeedback((current) => ({ ...current, [placeId]: { message: apiError?.message ?? "The place could not be added.", needsItinerary: apiError?.code === "NO_ACTIVE_ITINERARY" } }));
    }
  };

  if (isLoading) return <main className="flex min-h-[70vh] items-center justify-center bg-bg px-4"><p className="text-muted">Loading saved places...</p></main>;
  if (loadError) return <main className="flex min-h-[70vh] items-center justify-center bg-bg px-4"><div className="max-w-xl rounded-panel border bg-surface p-10 text-center shadow-panel"><h1 className="text-2xl font-semibold">Unable to load saved places</h1><p className="mt-3 text-muted">{loadError.message}</p><button type="button" onClick={() => void refreshSavedPlaces()} className="mt-6 rounded-full bg-fg px-5 py-3 text-sm font-semibold text-accent-fg">Try again</button></div></main>;
  if (!savedPlaces.length) return <main className="flex min-h-[70vh] items-center justify-center bg-bg px-4"><div className="max-w-xl rounded-panel border bg-surface p-10 text-center shadow-panel"><HeartOff className="mx-auto text-muted" size={32} /><p className="mt-5 text-sm font-semibold uppercase tracking-wider text-accent">Saved places</p><h1 className="mt-3 text-3xl font-semibold">No saved places yet</h1><p className="mt-4 text-muted">Save a real place to build your shortlist.</p><Link to="/destinations" className="mt-7 inline-flex items-center gap-2 rounded-full bg-fg px-5 py-3 text-sm font-semibold text-accent-fg"><Compass size={16} />Explore destinations</Link></div></main>;
  const total = pagination?.total ?? savedPlaces.length;
  return <main className="min-h-[70vh] bg-bg"><section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><p className="text-sm font-semibold uppercase tracking-wider text-accent">Saved places</p><h1 className="mt-2 text-3xl font-semibold">Your place shortlist</h1><p className="mt-3 text-muted">{total} saved {total === 1 ? "place" : "places"}</p>{mutationError && <div role="alert" className="mt-6 flex items-center justify-between gap-4 rounded-panel bg-bg p-4 text-sm text-fg"><span>{mutationError.message}</span><button type="button" onClick={clearMutationError} className="font-semibold">Dismiss</button></div>}<div className="mt-8 grid gap-6 lg:grid-cols-2">{savedPlaces.map(({ placeId, place }) => { const removing = isRemovingPlace(placeId); const adding = isAddingPlace(placeId); const occurrenceCount = getPlaceOccurrenceCount(placeId); const feedback = itineraryFeedback[placeId]; return <article key={placeId} className="overflow-hidden rounded-panel border bg-surface shadow-panel"><div className="h-48 bg-line"><LocalPhoto src={place.imageUrl} alt={place.name} category={place.category} className="h-full w-full object-cover" /></div><div className="p-6"><p className="text-xs font-semibold uppercase tracking-wider text-accent">{place.category}</p><h2 className="mt-2 text-2xl font-semibold">{place.name}</h2><p className="mt-3 flex gap-2 text-sm text-muted"><MapPin size={15} />{place.address ?? "Address unavailable"}</p><p className="mt-4 text-sm leading-6 text-muted">{place.description}</p>{occurrenceCount > 0 && <p className="mt-3 text-sm font-semibold text-accent">Added {occurrenceCount} {occurrenceCount === 1 ? "time" : "times"} to the active itinerary.</p>}<div className="mt-6 flex flex-wrap gap-3"><button disabled={removing} onClick={() => void removePlace(placeId).catch(() => undefined)} className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold disabled:cursor-wait disabled:opacity-60"><Trash2 size={15} />{removing ? "Removing..." : "Remove"}</button><Link to={`/destinations/${place.destinationId}/places/${placeId}`} className="inline-flex items-center gap-2 rounded-full bg-fg px-4 py-2.5 text-sm font-semibold text-accent-fg">View details <ArrowRight size={15} /></Link><button disabled={adding} onClick={() => void handleAddToItinerary(placeId)} className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-accent disabled:cursor-wait disabled:opacity-60">{adding ? "Adding..." : "Add to itinerary"}</button></div>{feedback && <p role="status" className="mt-4 rounded-control bg-tint p-3 text-sm text-accent">{feedback.message}{feedback.needsItinerary && <> <Link to="/itinerary" className="font-semibold underline">Open itinerary</Link></>}</p>}</div></article>; })}</div></section></main>;
}

export default SavedPlaces;
