import { lazy, Suspense } from "react";
import {
  Routes,
  Route,
} from "react-router-dom";

import ScrollToTop from "./components/common/ScrollToTop";
import AuthLayout from "./layouts/AuthLayout";
import MainLayout from "./layouts/MainLayout";
import Home from "./pages/Home";
import PhotoCredits from "./pages/PhotoCredits";
import PrivacyNotice from "./pages/PrivacyNotice";
import Destinations from "./pages/DestinationsLive";
import DestinationDetails from "./pages/DestinationDetails";
import Profile from "./pages/Profile";
import AccountSettings from "./pages/AccountSettings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AIAssistant from "./pages/AIAssistant";
import Itinerary from "./pages/Itinerary";
import MyItineraries from "./pages/MyItineraries";
import SavedPlaces from "./pages/SavedPlaces";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminRoute from "./components/auth/AdminRoute";

const PlaceDetails = lazy(() => import("./pages/PlaceDetails"));
const PrintItinerary = lazy(() => import("./pages/print/PrintItinerary"));
const PrintAdminReport = lazy(() => import("./pages/print/PrintAdminReport"));

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/credits" element={<PhotoCredits />} />
        <Route path="/privacy" element={<PrivacyNotice />} />
        <Route path="/explore" element={<Destinations />} />
        <Route path="/destinations" element={<Destinations />} />
        <Route path="/destinations/:destinationId" element={<DestinationDetails />} />
        <Route path="/destinations/:destinationId/places/:placeId" element={<Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-muted">Loading place...</div>}><PlaceDetails /></Suspense>} />

        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/ai-assistant" element={<AIAssistant />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/account-settings" element={<AccountSettings />} />
          <Route path="/itinerary" element={<Itinerary />} />
          <Route path="/history" element={<MyItineraries />} />
          <Route path="/saved-trips" element={<SavedPlaces />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/itineraries/:id/print" element={<Suspense fallback={<p className="p-8 text-center">Loading print view...</p>}><PrintItinerary /></Suspense>} />
      </Route>

      <Route element={<AdminRoute />}>
        <Route path="/admin/report/print" element={<Suspense fallback={<p role="status">Loading report...</p>}><PrintAdminReport /></Suspense>} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  );
}

export default App;
