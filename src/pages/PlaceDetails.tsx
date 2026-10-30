import PhotoPlaceholder from "../components/common/PhotoPlaceholder";
import LocalPhoto from "../components/common/LocalPhoto";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarPlus, Heart, LoaderCircle, MapPin, Star, Wallet2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getPlace } from "../api/places.api";
import { NearbyPlacesSection } from "../components/places/NearbyPlacesSection";
import { PriceLevelBadge } from "../components/common/PriceLevelBadge";
import { useSavedPlaces } from "../context/SavedPlacesContext";
import { useItinerary } from "../context/ItineraryContext";
import { ApiError } from "../lib/api-client";
import type { Place } from "../types/place";

function PlaceDetails() {
  const params = useParams();
  const destinationId = Number(params.destinationId);
  const placeId = Number(params.placeId);
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [needsItinerary, setNeedsItinerary] = useState(false);
  const { savePlace, removePlace: removeSavedPlace, isPlaceSaved, isSavingPlace, isRemovingPlace, clearMutationError } = useSavedPlaces();
  const { activeItineraryId, addPlace, getPlaceOccurrenceCount, isAddingPlace } = useItinerary();

  useEffect(() => {
    if (![destinationId, placeId].every((value) => Number.isInteger(value) && value > 0)) { setNotFound(true); setLoading(false); return; }
    let active = true; setLoading(true); setNotFound(false); setError("");
    getPlace(placeId).then((result) => { if (!active) return; if (result.destinationId !== destinationId) { setNotFound(true); return; } setPlace(result); }).catch((caught: unknown) => { if (!active) return; const status = typeof caught === "object" && caught !== null && "status" in caught ? Number(caught.status) : 0; if (status === 404) setNotFound(true); else setError("This place could not be loaded. Please try again."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [destinationId, placeId, retryKey]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted"><LoaderCircle className="animate-spin" />Loading place...</div>;
  if (notFound) return <PlaceError title="Place not found" message="This place does not belong to the requested destination, or it does not exist." />;
  if (error || !place) return <PlaceError title="Could not load this page" message={error || "An unexpected response was received."} onRetry={() => setRetryKey((value) => value + 1)} />;

  const saved = isPlaceSaved(place.id);
  const occurrenceCount = getPlaceOccurrenceCount(place.id);
  const adding = isAddingPlace(place.id);
  const saving = isSavingPlace(place.id);
  const removing = isRemovingPlace(place.id);
  const handleSave = async () => {
    setFeedback("");
    setNeedsItinerary(false);
    clearMutationError();
    try {
      if (saved) {
        await removeSavedPlace(place.id);
        setFeedback("Removed from Saved Places.");
      } else {
        await savePlace(place.id);
        setFeedback("Saved to Saved Places.");
      }
    } catch (caught) {
      setFeedback(caught instanceof ApiError ? caught.message : "The saved place could not be updated.");
    }
  };
  const handleAdd = async () => {
    setFeedback("");
    setNeedsItinerary(false);
    if (activeItineraryId === null) {
      setFeedback("Create or select an itinerary first.");
      setNeedsItinerary(true);
      return;
    }
    try {
      const item = await addPlace(place.id);
      setFeedback(`Added to Day ${item.day} ${item.timeSlot} (order ${item.order}).`);
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;
      setFeedback(apiError?.message ?? "The place could not be added to your itinerary.");
      setNeedsItinerary(apiError?.code === "NO_ACTIVE_ITINERARY");
    }
  };

  return <main className="min-h-[70vh] bg-bg pb-16">
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><Link to={`/destinations/${destinationId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-accent"><ArrowLeft size={16} />Back to {place.destination?.name ?? "destination"}</Link>
      <div className="mt-7 overflow-hidden rounded-panel border border-line bg-surface shadow-panel"><div className="grid lg:grid-cols-2"><div className="min-h-96 bg-line"><LocalPhoto src={place.imageUrl} alt={place.name} className="h-full w-full object-cover" fallback={<PhotoPlaceholder name={place.name} category={place.category} className="min-h-96" />} /></div><div className="p-8 sm:p-10"><p className="text-sm font-semibold uppercase tracking-wider text-accent">{place.category}</p><h1 className="mt-3 text-4xl font-semibold text-fg">{place.name}</h1>{place.address && <p className="mt-4 flex gap-2 text-muted"><MapPin size={18} className="mt-0.5 shrink-0" />{place.address}</p>}<p className="mt-6 text-lg leading-8 text-muted">{place.description}</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2"><div className="rounded-panel bg-bg p-4 text-fg"><span className="flex items-center gap-2 text-sm font-semibold"><Star size={16} />Rating</span><p className="mt-2 text-lg font-semibold">{place.rating?.toFixed(1) ?? "Not rated"}</p></div><div className="rounded-panel bg-tint p-4 text-accent"><span className="flex items-center gap-2 text-sm font-semibold"><Wallet2 size={16} />Price level</span><div className="mt-2"><PriceLevelBadge priceLevel={place.priceLevel} /></div></div></div>
        <div className="mt-7 flex flex-wrap gap-3"><button onClick={() => void handleSave()} disabled={saving || removing} className="inline-flex items-center gap-2 rounded-full bg-fg px-5 py-3 text-sm font-semibold text-accent-fg disabled:cursor-wait disabled:opacity-60"><Heart size={16} />{saving ? "Saving..." : removing ? "Removing..." : saved ? "Remove saved place" : "Save Place"}</button><button onClick={() => void handleAdd()} disabled={adding} className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-3 text-sm font-semibold text-fg disabled:cursor-wait disabled:opacity-60"><CalendarPlus size={16} />{adding ? "Adding..." : "Add to itinerary"}</button></div>{occurrenceCount > 0 && <p className="mt-3 text-sm font-semibold text-accent">Added {occurrenceCount} {occurrenceCount === 1 ? "time" : "times"} to the active itinerary.</p>}{feedback && <p role="status" className="mt-4 rounded-control bg-tint p-3 text-sm text-accent">{feedback}{needsItinerary && <> <Link to="/itinerary" className="font-semibold underline">Open itinerary</Link></>}</p>}</div></div></div>
    </section>
    <NearbyPlacesSection place={place} />
  </main>;
}

function PlaceError({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) { return <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4 text-center"><div className="rounded-panel border bg-surface p-10 shadow-panel"><p className="text-sm font-semibold uppercase tracking-wider text-accent">{onRetry ? "Load error" : "404"}</p><h1 className="mt-3 text-3xl font-semibold">{title}</h1><p className="mt-3 text-muted">{message}</p>{onRetry && <button type="button" onClick={onRetry} className="mr-3 mt-6 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-fg">Retry</button>}<Link to="/destinations" className="mt-6 inline-flex rounded-full bg-fg px-5 py-3 text-sm font-semibold text-accent-fg">Back to destinations</Link></div></div>; }

export default PlaceDetails;
