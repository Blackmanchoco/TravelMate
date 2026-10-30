import { allowedDatabaseName, assertIsolatedDatabase } from "./guard.js";

try {
  if (allowedDatabaseName(process.env.DATABASE_URL) !== "travelmate_c4_restore_20261005") {
    throw new Error("Database name is not the approved stage 2 isolate");
  }
  const name = await assertIsolatedDatabase();
  if (process.argv.includes("--guard-only")) {
    console.log(`Isolated database verified: ${name}`);
  } else {
    if (process.env.PORT !== "5054") throw new Error("Database tests require port 5054");
    const { startVitest } = await import("vitest/node");
    const context = await startVitest(
      "test",
      ["test/db/admin-read.integration.ts", "test/db/admin-place.integration.ts"],
      { run: true, include: ["test/db/*.integration.ts"], fileParallelism: false },
    );
    if (!context || context.state.getTestModules().some((module) => !module.ok())) process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error && error.message.startsWith("Database")
    ? error.message
    : "Isolated database guard failed";
  console.error(message);
  process.exitCode = 1;
}
