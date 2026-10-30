import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";

const links = [
  { label: "Home", to: "/" },
  { label: "Photo credits", to: "/credits" },
  { label: "Privacy Notice", to: "/privacy" },
  { label: "Destinations", to: "/destinations" },
  { label: "AI Assistant", to: "/ai-assistant" },
  { label: "Saved Places", to: "/saved-trips" },
  { label: "Itinerary", to: "/itinerary" },
];

function Footer() {
  return (
    <footer className="bg-fg text-tint">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8">
        <div className="max-w-md">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-control bg-accent text-accent-fg">
              <MapPin size={22} />
            </div>
            <div>
              <span className="block text-lg font-bold text-accent-fg">TravelMate</span>
              <span className="text-xs text-tint">Malaysian Tourism</span>
            </div>
          </Link>
          <p className="mt-5 text-sm leading-7 text-tint">
            Browse real Malaysian destinations and places, save favourites, and build itineraries. The local AI assistant (qwen3:8b) answers from the TravelMate catalogue.
          </p>
        </div>

        <nav aria-label="Footer navigation">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-accent-fg">Explore</h3>
          <ul className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
            {links.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-tint transition hover:text-accent-fg">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-tint sm:px-6 lg:px-8">
          © {new Date().getFullYear()} TravelMate. Academic project prototype.
        </div>
      </div>
    </footer>
  );
}

export default Footer;
