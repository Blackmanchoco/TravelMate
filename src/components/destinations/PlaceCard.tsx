import PhotoPlaceholder from "../common/PhotoPlaceholder";
import LocalPhoto from "../common/LocalPhoto";
import { ArrowRight, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import type { Place } from "../../types/place";

function PlaceCard({ place }: { place: Place }) {
  return <article className="group overflow-hidden rounded-panel border border-line bg-surface shadow-panel transition hover:-translate-y-1 hover:shadow-panel">
    <div className="h-52 overflow-hidden bg-tint">
      <LocalPhoto src={place.imageUrl} alt={place.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" fallback={<PhotoPlaceholder name={place.name} category={place.category} />} />
    </div>
    <div className="p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-accent">{place.category}</p><h3 className="mt-1 text-lg font-semibold text-fg">{place.name}</h3></div>{place.rating !== null && <span className="inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-sm font-semibold text-fg"><Star size={13} className="fill-accent text-muted" />{place.rating.toFixed(1)}</span>}</div>
      {place.address && <p className="mt-3 flex items-start gap-2 text-sm text-muted"><MapPin size={15} className="mt-0.5 shrink-0" />{place.address}</p>}
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{place.description}</p>
      <Link to={`/destinations/${place.destinationId}/places/${place.id}`} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent">View place <ArrowRight size={15} /></Link>
    </div>
  </article>;
}
export default PlaceCard;
