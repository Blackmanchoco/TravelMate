import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import LocalPhoto from "../common/LocalPhoto";
import PhotoPlaceholder from "../common/PhotoPlaceholder";
import SearchBar from "./SearchBar";

export default function Hero() {
  return <section className="relative isolate overflow-hidden bg-fg text-accent-fg">
    <div className="absolute inset-0 -z-10" aria-hidden="true">
      <LocalPhoto src="/images/destinations/kuala-lumpur.jpg" alt="Kuala Lumpur skyline" className="h-full w-full object-cover" fallback={<PhotoPlaceholder name="Kuala Lumpur" className="h-full" />} />
      <div className="absolute inset-0 bg-fg/65" />
      <div className="absolute inset-0 bg-gradient-to-r from-fg/90 via-fg/45 to-fg/20" />
    </div>
    <div className="mx-auto grid min-h-[640px] max-w-7xl items-center px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="max-w-3xl">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-tint"><MapPin size={17} aria-hidden="true" />Malaysia, one stop at a time</p>
        <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl">Find your places.<br />Make the trip yours.</h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-accent-fg sm:text-lg">Explore TravelMate's Malaysian place catalogue, save your stops, and build a day-by-day itinerary with budget and preference summaries.</p>
        <SearchBar />
        <Link to="/destinations" className="mt-6 inline-flex min-h-10 items-center gap-2 py-2 text-sm font-semibold text-accent-fg underline decoration-surface/50 underline-offset-4">Browse destinations <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    </div>
  </section>;
}
