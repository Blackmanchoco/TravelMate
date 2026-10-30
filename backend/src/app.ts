import cors from "cors";
import express from "express";

import { corsOptions } from "./config/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { securityHeaders } from "./middleware/security-headers.js";
import { notFoundHandler } from "./middleware/not-found-handler.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { destinationsRoutes } from "./modules/destinations/destinations.routes.js";
import { placesRoutes } from "./modules/places/places.routes.js";
import { savedPlacesRoutes } from "./modules/saved-places/saved-places.routes.js";
import { itinerariesRoutes } from "./modules/itineraries/itineraries.routes.js";
import { recommendationsRoutes } from "./modules/recommendations/recommendations.routes.js";
import { aiRoutes } from "./modules/ai/ai.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/destinations", destinationsRoutes);
app.use("/api/places", placesRoutes);
app.use("/api/saved-places", savedPlacesRoutes);
app.use("/api/itineraries", itinerariesRoutes);
app.use("/api/recommendations", recommendationsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
