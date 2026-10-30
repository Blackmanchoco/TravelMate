import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  ChevronDown,
  LogOut,
  Menu,
  Plane,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const publicNavigation = [
  { name: "Home", path: "/" },
  { name: "Explore", path: "/explore" },
];

const privateNavigation = [
  { name: "Home", path: "/" },
  { name: "Explore", path: "/explore" },
  { name: "AI Assistant", path: "/ai-assistant" },
  { name: "Itinerary", path: "/itinerary" },
  { name: "Saved Places", path: "/saved-trips" },
];

function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = user?.name ?? "Traveler";
  const isAdmin = isAuthenticated && user?.role === "admin";

  const navigation = isAdmin ? [] : isAuthenticated ? privateNavigation : publicNavigation;

  const handleLogout = () => {
    setMenuOpen(false);
    setMobileMenuOpen(false);
    logout();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-surface/70 bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to={isAdmin ? "/admin" : "/"} className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
          <div className="flex h-11 w-11 items-center justify-center rounded-control bg-accent text-accent-fg shadow-panel">
            <Plane size={23} strokeWidth={2.5} />
          </div>

          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-fg">TravelMate</span>
            <span className="text-xs font-medium text-muted">Malaysian Tourism</span>
          </div>
        </Link>

        {isAdmin ? <Link to="/admin" aria-label="Admin console" className="rounded-full bg-tint px-4 py-2 text-sm font-semibold text-accent">Admin</Link> : <nav className="hidden items-center gap-7 lg:flex">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `relative py-2 text-sm font-medium transition-colors ${isActive ? "text-accent" : "text-muted hover:text-accent"}`
              }
            >
              {({ isActive }) => (
                <>
                  {item.name}
                  {isActive && <span className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-accent" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>}

        <div className="hidden items-center gap-3 lg:flex">
          {!isAuthenticated ? (
            <>
              <Link to="/login" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-fg transition hover:bg-bg hover:text-accent">
                <UserRound size={18} />
                Login
              </Link>

              <Link to="/register" className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg shadow-panel transition hover:bg-accent">
                Get Started
              </Link>
            </>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                aria-expanded={menuOpen}
                className="flex items-center gap-3 rounded-full border border-line bg-surface/80 px-2.5 py-2 shadow-panel transition hover:border-line hover:shadow-panel"
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt={displayName} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden text-left md:block">
                  <p className="text-sm font-semibold text-fg">{displayName}</p>
                  <p className="text-xs text-muted">{user?.email}</p>
                </div>
                <ChevronDown size={16} className={`text-muted transition ${menuOpen ? "rotate-180" : "rotate-0"}`} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-3 w-48 rounded-panel border border-line bg-surface p-2 shadow-panel">
                  <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-fg transition hover:bg-bg hover:text-accent">
                    <UserRound size={16} />
                    Profile
                  </Link>
                  {isAdmin && <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-fg transition hover:bg-bg hover:text-accent">Admin console</Link>}
                  <Link to="/account-settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-fg transition hover:bg-bg hover:text-accent">
                    <Settings size={16} />
                    Settings
                  </Link>
                  <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm font-medium text-fg transition hover:bg-bg hover:text-muted">
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button type="button" aria-label={isAdmin ? "Toggle account menu" : "Toggle navigation menu"} onClick={() => setMobileMenuOpen((current) => !current)} className="flex h-10 w-10 items-center justify-center rounded-control text-fg transition hover:bg-tint lg:hidden">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-line bg-surface/95 lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-4 sm:px-6">
            {navigation.map((item) => (
              <NavLink key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `rounded-control px-4 py-3 text-sm font-medium transition ${isActive ? "bg-tint text-accent" : "text-fg hover:bg-bg"}`}>
                {item.name}
              </NavLink>
            ))}

            <div className="mt-3 flex flex-col gap-2 border-t border-line pt-4">
              {!isAuthenticated ? (
                <>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-2 rounded-control border border-line px-4 py-3 text-sm font-semibold text-fg">
                    <UserRound size={18} />
                    Login
                  </Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="rounded-control bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-fg">
                    Get Started
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 rounded-control border border-line px-4 py-3 text-sm font-semibold text-fg">
                    <UserRound size={18} />
                    Profile
                  </Link>
                  {isAdmin && <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 rounded-control border border-line px-4 py-3 text-sm font-semibold text-fg">Admin console</Link>}
                  <Link to="/account-settings" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 rounded-control border border-line px-4 py-3 text-sm font-semibold text-fg">
                    <Settings size={18} />
                    Settings
                  </Link>
                  <button type="button" onClick={handleLogout} className="flex items-center justify-center gap-2 rounded-control border border-line bg-bg px-4 py-3 text-sm font-semibold text-muted">
                    <LogOut size={18} />
                    Logout
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export default Header;
