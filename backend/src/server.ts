import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.port, () => {
  console.log(`TravelMate backend listening on http://localhost:${env.port}`);
});

function shutdown(signal: NodeJS.Signals) {
  console.log(`${signal} received. Closing backend server.`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
