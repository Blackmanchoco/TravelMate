const ALLOWED_DATABASE = /^travelmate_c4_restore_\d{8}$/;

export function allowedDatabaseName(connectionString: string | undefined): string {
  if (!connectionString) throw new Error("DATABASE_URL is required for isolated tests");
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL is invalid for isolated tests");
  }
  if (!(["postgres:", "postgresql:"].includes(parsed.protocol))) {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }
  if (parsed.hash || [...parsed.searchParams.keys()].some((key) => key !== "schema")) {
    throw new Error("Database URL override parameters are not allowed for isolated tests");
  }
  const name = decodeURIComponent(parsed.pathname.slice(1));
  if (!ALLOWED_DATABASE.test(name)) throw new Error("Database name is not allowlisted for isolated tests");
  return name;
}

export async function assertIsolatedDatabase(connectionString = process.env.DATABASE_URL): Promise<string> {
  const expected = allowedDatabaseName(connectionString);
  // The pg module and any test modules are loaded only after the URL name passes.
  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query<{ name: string }>("SELECT current_database() AS name");
    if (result.rows[0]?.name !== expected) throw new Error("Connected database name does not match the allowlist");
    return expected;
  } finally {
    await client.end();
  }
}
