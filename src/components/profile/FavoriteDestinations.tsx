import LocalPhoto from "../common/LocalPhoto";
import { ArrowRight, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import type { ApiError } from "../../lib/api-client";
import type { SavedPlace } from "../../types/saved-place";

interface FavoriteDestinationsProps {
  savedPlaces: SavedPlace[];
  isLoading: boolean;
  loadError: ApiError | null;
  mutationError: ApiError | null;
  onRetry: () => Promise<void>;
  onRemove: (placeId: number) => Promise<void>;
  isRemoving: (placeId: number) => boolean;
  onClearMutationError: () => void;
}

export function FavoriteDestinations({ savedPlaces, isLoading, loadError, mutationError, onRetry, onRemove, isRemoving, onClearMutationError }: FavoriteDestinationsProps) {
  return (
    <div className="rounded-panel border border-line bg-surface p-6 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Saved places</p>
          <h2 className="mt-2 text-2xl font-semibold text-fg">Your favourite places</h2>
        </div>
        <Link to="/saved-trips" className="text-sm font-semibold text-accent transition hover:text-accent">View all</Link>
      </div>

      <div className="mt-6 space-y-4">
        {isLoading && <div className="rounded-panel border border-line bg-bg p-5 text-sm text-muted">Loading saved places...</div>}
        {!isLoading && loadError && <div className="rounded-panel border border-line bg-bg p-5 text-sm text-fg"><p>{loadError.message}</p><button type="button" onClick={() => void onRetry()} className="mt-3 font-semibold">Try again</button></div>}
        {mutationError && <div role="alert" className="flex items-center justify-between gap-3 rounded-panel border border-line bg-bg p-5 text-sm text-fg"><span>{mutationError.message}</span><button type="button" onClick={onClearMutationError} className="font-semibold">Dismiss</button></div>}
        {!isLoading && !loadError && savedPlaces.length === 0 && <div className="rounded-panel border border-dashed border-line bg-bg p-5 text-sm text-muted">No saved places yet. Save a place to see it here.</div>}
        {savedPlaces.map(({ placeId, place }) => (
          <div key={placeId} className="overflow-hidden rounded-panel border border-line bg-bg">
            <div className="flex flex-col sm:flex-row">
              <LocalPhoto src={place.imageUrl} alt={place.name} category={place.category} className="h-36 w-full shrink-0 object-cover sm:h-auto sm:w-36" />
              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-fg">{place.name}</h3>
                    <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-muted">{place.rating?.toFixed(1) ?? "—"}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{place.address ?? "Malaysia"}</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Link to={`/destinations/${place.destinationId}/places/${placeId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-accent">View details <ArrowRight size={14} /></Link>
                  <button type="button" disabled={isRemoving(placeId)} onClick={() => void onRemove(placeId).catch(() => undefined)} aria-label={`Remove ${place.name} from saved places`} className="rounded-full bg-surface p-2 text-muted shadow-panel disabled:cursor-wait disabled:opacity-50">
                    <Heart size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
