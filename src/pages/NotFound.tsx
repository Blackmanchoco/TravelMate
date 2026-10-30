import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Compass,
  MapPin,
  Plane,
  Sparkles,
} from "lucide-react";

function NotFound() {
  return (
    <div className="min-h-[80vh] bg-bg">
      <section className="mx-auto flex min-h-[80vh] max-w-7xl items-center px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="order-2 lg:order-1"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-tint px-3 py-1 text-sm font-semibold text-accent">
              <Compass size={16} />
              Route lost
            </div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-fg sm:text-5xl lg:text-6xl">
              Looks like you got lost on your journey.
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
              The page you’re looking for may have moved, been removed, or never existed. Let’s get you back to discovering beautiful places in Malaysia.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full bg-fg px-5 py-3 text-sm font-semibold text-accent-fg transition hover:bg-fg"
              >
                Back to Home
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/explore"
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-fg shadow-panel transition hover:border-line hover:text-accent"
              >
                Explore Destinations
                <MapPin size={16} />
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted">
              <div className="rounded-full border border-line bg-surface px-3 py-2">Real place catalogue</div>
              <div className="rounded-full border border-line bg-surface px-3 py-2">Local AI assistant (qwen3:8b) answering from the TravelMate catalogue</div>
              <div className="rounded-full border border-line bg-surface px-3 py-2">Saved itineraries</div>
            </div>
          </motion.div>

          <motion.div
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="order-1 lg:order-2"
          >
            <div className="relative mx-auto max-w-xl overflow-hidden rounded-panel border border-line bg-surface p-4 shadow-panel sm:p-6">
              <div className="absolute inset-0 bg-bg" />

              <motion.div
                animate={{ y: [0, -8, 0], rotate: [0, -2, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="relative overflow-hidden rounded-panel border border-surface/70 bg-surface/80 p-6 backdrop-blur"
              >
                <div className="absolute -right-4 -top-4 rounded-full bg-tint p-3 text-accent">
                  <Sparkles size={18} />
                </div>

                <div className="relative flex items-center justify-center rounded-panel border border-dashed border-line bg-bg p-6 sm:p-8">
                  <div className="relative h-64 w-full max-w-[360px] sm:h-72">
                    <div className="absolute left-4 top-8 h-24 w-24 rounded-full bg-accent opacity-80 blur-3xl" />
                    <div className="absolute bottom-8 right-6 h-20 w-20 rounded-full bg-line opacity-70 blur-3xl" />

                    <div className="absolute left-10 top-10 rounded-full border border-line bg-surface/90 p-3 shadow-panel">
                      <Plane size={24} className="text-accent" />
                    </div>
                    <div className="absolute bottom-7 left-8 rounded-panel border border-line bg-surface/90 p-3 shadow-panel">
                      <MapPin size={24} className="text-accent" />
                    </div>
                    <div className="absolute right-8 top-20 rounded-panel border border-line bg-surface/90 p-3 shadow-panel">
                      <Sparkles size={24} className="text-muted" />
                    </div>

                    <div className="absolute inset-x-0 bottom-6 mx-auto flex h-28 w-28 items-center justify-center rounded-panel border border-line bg-accent text-5xl font-semibold text-accent-fg shadow-panel">
                      404
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative mt-4 rounded-panel border border-line bg-bg px-4 py-3 text-sm text-muted"
              >
                <div className="flex items-center gap-2 font-semibold text-fg">
                  <Compass size={16} className="text-accent" />
                  Your itinerary is still on the map.
                </div>
                <p className="mt-1">Choose a destination below and continue your adventure.</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

export default NotFound;
