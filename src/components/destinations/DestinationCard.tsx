import LocalPhoto from "../../components/common/LocalPhoto";
import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import type { Destination } from "../../types/destination";

interface DestinationCardProps {
  destination: Destination;
}

function DestinationCard({ destination }: DestinationCardProps) {
  const imageUrl = destination.imageUrl;
  const location = `${destination.city}, ${destination.state}`;
  return <article className="group overflow-hidden rounded-panel border border-line bg-surface shadow-panel transition hover:-translate-y-1 hover:shadow-panel">
    <div className="relative h-60 overflow-hidden bg-line">
      <LocalPhoto src={imageUrl} alt={destination.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-fg/80 to-transparent" />
      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-sm font-medium text-accent-fg"><MapPin size={15} />{location}</div>
    </div>
    <div className="p-6"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-xl font-semibold text-fg">{destination.name}</h3>{destination.placeCount !== undefined && <span className="text-sm font-medium text-muted">{destination.placeCount} {destination.placeCount === 1 ? "place" : "places"}</span>}</div><p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{destination.description}</p><Link to={`/destinations/${destination.id}`} className="mt-6 inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg hover:bg-accent">Explore places <ArrowRight size={16} /></Link></div>
  </article>;
}

export default DestinationCard;
