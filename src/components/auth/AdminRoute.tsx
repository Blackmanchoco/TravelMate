import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import NotFound from "../../pages/NotFound";

export default function AdminRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-bg px-4">
        <p className="text-sm font-medium text-muted">Checking administrator access…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  if (user?.role !== "admin") {
    return <NotFound />;
  }

  return <Outlet />;
}
