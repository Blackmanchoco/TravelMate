import { CalendarDays, Compass, Edit3 } from "lucide-react";
import { Link } from "react-router-dom";

interface ProfileHeaderProps {
  name: string;
  email: string;
  joined: string;
  avatar: string | null;
  isAdmin?: boolean;
}

export function ProfileHeader({ name, email, joined, avatar, isAdmin = false }: ProfileHeaderProps) {
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
      <div className="bg-accent px-6 py-8 text-accent-fg sm:px-8 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {avatar ? (
              <img src={avatar} alt={name} className="h-24 w-24 rounded-panel border border-surface/40 object-cover shadow-panel" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-panel border border-surface/40 bg-surface/15 text-3xl font-semibold shadow-panel">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-semibold sm:text-4xl">{name}</h1>
              <p className="mt-3 max-w-xl text-base leading-7 text-tint">
                {email}{isAdmin && <> · Admin</>}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface/15 px-3 py-1.5 text-sm text-accent-fg/90">
                <CalendarDays size={15} /> Joined {joined}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/account-settings" className="inline-flex items-center gap-2 rounded-full border border-surface/30 bg-surface/15 px-4 py-2.5 text-sm font-semibold text-accent-fg transition hover:bg-surface/25">
              <Edit3 size={16} /> Edit profile
            </Link>
            {isAdmin ? (
              <Link to="/admin" className="inline-flex items-center gap-2 rounded-full bg-fg/20 px-4 py-2.5 text-sm font-semibold text-accent-fg transition hover:bg-fg/30">
                <Compass size={16} /> Open admin console
              </Link>
            ) : (
              <Link to="/itinerary" className="inline-flex items-center gap-2 rounded-full bg-fg/20 px-4 py-2.5 text-sm font-semibold text-accent-fg transition hover:bg-fg/30">
                <Compass size={16} /> View itineraries
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
