import type { CorsOptions } from "cors";

import { env } from "./env.js";

export const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
};
