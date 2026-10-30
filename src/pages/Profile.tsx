import { useRef, useState } from "react";
import { BookOpen, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { AccountSettingsCard } from "../components/profile/AccountSettingsCard";
import { FavoriteDestinations } from "../components/profile/FavoriteDestinations";
import { ProfileHeader } from "../components/profile/ProfileHeader";
import { StatisticsGrid } from "../components/profile/StatisticsGrid";
import { TravelPreferences } from "../components/profile/TravelPreferences";
import { UpcomingTrips } from "../components/profile/UpcomingTrips";
import { useAuth } from "../hooks/useAuth";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { useSavedPlaces } from "../context/SavedPlacesContext";
import { useItinerary } from "../context/ItineraryContext";

function formatJoined(value: string) {
  return new Intl.DateTimeFormat("en-MY", { month: "long", year: "numeric" }).format(new Date(value));
}

function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { preferences, isLoading: preferencesLoading, loadError: preferencesError, refresh: refreshPreferences } = useUserPreferences();
  const { savedPlaces, pagination: savedPagination, isLoading: savedPlacesLoading, loadError: savedPlacesError, mutationError: savedPlacesMutationError, refreshSavedPlaces, removePlace, isRemovingPlace, clearMutationError } = useSavedPlaces();
  const { itineraries, pagination: itineraryPagination, isLoading: itinerariesLoading, loadError: itinerariesError, refreshItineraries, selectItinerary } = useItinerary();

  const [openError, setOpenError] = useState<string | null>(null);
  const openingRef = useRef(false);

  if (!user) return null;
  const isAdmin = user.role === "admin";

  const stats = [
    { label: "Saved Places", value: savedPlacesError || savedPlacesLoading ? null : (savedPagination?.total ?? savedPlaces.length), icon: Heart, accent: "bg-accent" },
    { label: "Itineraries", value: itinerariesError || itinerariesLoading ? null : (itineraryPagination?.total ?? itineraries.length), icon: BookOpen, accent: "bg-accent" },
  ];

  const openItinerary = async (id: number) => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpenError(null);
    try {
      if (await selectItinerary(id)) navigate("/itinerary");
      else setOpenError("Unable to open this itinerary. Please refresh the list and try again.");
    } catch {
      setOpenError("Unable to open this itinerary. Please refresh the list and try again.");
    } finally {
      openingRef.current = false;
    }
  };

  return (
    <div className="bg-bg">
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <ProfileHeader name={user.name} email={user.email} avatar={user.avatar} joined={formatJoined(user.createdAt)} isAdmin={isAdmin} />
          {!isAdmin && (
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-panel border border-line bg-surface p-6 shadow-panel">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Travel overview</p>
                <h2 className="mt-2 text-2xl font-semibold text-fg">Your saved data</h2>
                <div className="mt-6"><StatisticsGrid stats={stats} /></div>
                {(savedPlacesError || itinerariesError) && <p className="mt-4 text-sm text-fg">One or more totals could not be loaded. A dash is shown instead of an invented value.</p>}
              </div>
              <TravelPreferences preferences={preferences} isLoading={preferencesLoading} error={preferencesError} onRetry={refreshPreferences} />
            </div>
          )}
        </motion.div>
      </section>

      {!isAdmin && (
        <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
          <div className="space-y-6">
            <FavoriteDestinations savedPlaces={savedPlaces} isLoading={savedPlacesLoading} loadError={savedPlacesError} mutationError={savedPlacesMutationError} onRetry={refreshSavedPlaces} onRemove={removePlace} isRemoving={isRemovingPlace} onClearMutationError={clearMutationError} />
            {openError && <p role="alert" className="rounded-panel border border-line bg-bg p-4 text-sm text-fg">{openError}</p>}
            <UpcomingTrips itineraries={itineraries} isLoading={itinerariesLoading} error={itinerariesError} onRetry={refreshItineraries} onOpen={openItinerary} />
          </div>
          <div><AccountSettingsCard onLogout={logout} /></div>
        </section>
      )}
    </div>
  );
}

export default Profile;
