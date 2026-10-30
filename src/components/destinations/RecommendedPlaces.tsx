import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { listPlaces } from "../../api/places.api";
import type { Place } from "../../types/place";
import PlaceCard from "./PlaceCard";

function RecommendedPlaces() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Place[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let active = true; listPlaces({ page: 1, limit: 4, minRating: 4 }).then((result) => { if (active) setItems(result.items); }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, []);
  return <section className="bg-surface py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div className="max-w-2xl"><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-accent"><Star size={16} />Top-rated Places</p><h2 className="mt-3 text-3xl font-bold text-fg sm:text-4xl">Well-rated places from the live catalogue</h2><p className="mt-4 text-muted">Explore real places rated 4.0 or higher.</p></div><button onClick={() => navigate("/destinations")} className="text-sm font-semibold text-accent">Explore more</button></div>{failed ? <p className="mt-10 rounded-panel bg-bg p-5 text-fg">Places are temporarily unavailable.</p> : <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{items.map((item) => <PlaceCard key={item.id} place={item} />)}</div>}</div></section>;
}

export default RecommendedPlaces;
