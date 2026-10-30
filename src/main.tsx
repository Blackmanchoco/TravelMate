import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

import {
  BrowserRouter,
} from "react-router-dom";

import {
  ItineraryProvider,
} from "./context/ItineraryContext";
import { SavedPlacesProvider } from "./context/SavedPlacesContext";
import { AuthProvider } from "./context/AuthProvider";
import { AIChatProvider } from "./context/AIChatProvider";

import "leaflet/dist/leaflet.css";
import "./index.css";

ReactDOM.createRoot(
  document.getElementById("root")!
).render(

  <React.StrictMode>

    <BrowserRouter>

      <AuthProvider>

        <AIChatProvider>

        <SavedPlacesProvider>

          <ItineraryProvider>

            <App />

          </ItineraryProvider>

        </SavedPlacesProvider>

        </AIChatProvider>

      </AuthProvider>

    </BrowserRouter>

  </React.StrictMode>

);
