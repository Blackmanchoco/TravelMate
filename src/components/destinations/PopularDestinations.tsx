import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listDestinations } from "../../api/destinations.api";
import type { Destination } from "../../types/destination";
import SectionTitle from "../common/SectionTitle";
import DestinationCard from "./DestinationCard";

function PopularDestinations() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Destination[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let active = true; listDestinations({ page: 1, limit: 6 }).then((result) => { if (active) setItems(result.items); }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, []);
  return <section className="bg-surface py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><SectionTitle eyebrow="Explore Malaysian Destinations" title="Discover places across Malaysia" description="Explore destinations and places from TravelMate's live catalogue." actionText="View all destinations" onAction={() => navigate("/destinations")} />{failed ? <p className="mt-10 rounded-panel bg-bg p-5 text-fg">Destinations are temporarily unavailable.</p> : <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{items.map((item) => <DestinationCard key={item.id} destination={item} />)}</div>}</div></section>;
}

export default PopularDestinations;
