import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { Writable } from "node:stream";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

import { parse } from "dotenv";
import pg from "pg";

import { AppError } from "../core/errors/app-error.js";
import { hashPassword } from "../modules/auth/auth-credentials.js";
import {
  assertDatabaseTarget,
  assertNewUser,
  parseCreateAdminArgs,
  prepareAdminInput,
  type AdminInput,
} from "./create-admin-core.js";

const SAFE_ERRORS = new Set([
  "--confirm-database requires an exact database name.",
  "--stdin-json requires --confirm-database.",
  "Unknown or repeated Admin setup option.",
  "DATABASE_URL must be a PostgreSQL connection URL.",
  "Connected database name does not match DATABASE_URL.",
  "Database confirmation did not match the connected database name.",
  "Name is required and must be at most 100 characters.",
  "Password confirmation does not match.",
  "An account with this email already exists; no account was changed.",
  "Email is required.",
  "Email must be valid.",
  "Password is required.",
  "Password must be between 8 and 128 characters.",
  "Interactive mode requires a terminal.",
  "Credential input must be valid JSON with name, email, password, and passwordConfirmation.",
  "Credential input is too large.",
  "DATABASE_URL is missing. Set it in the process or backend/.env.",
]);

function configuredDatabaseUrl(): string {
  const envFile = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");
  const fromFile = existsSync(envFile) ? parse(readFileSync(envFile)).DATABASE_URL : undefined;
  const value = process.env.DATABASE_URL || fromFile;
  if (!value) throw new Error("DATABASE_URL is missing. Set it in the process or backend/.env.");
  return value;
}

async function readScriptedInput(): Promise<AdminInput> {
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += chunk;
    if (raw.length > 8192) throw new Error("Credential input is too large.");
  }
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object" || Array.isArray(value)
      || !["name", "email", "password", "passwordConfirmation"]
        .every((key) => typeof value[key] === "string")) {
      throw new Error("Invalid fields");
    }
  } catch {
    throw new Error("Credential input must be valid JSON with name, email, password, and passwordConfirmation.");
  }
  return prepareAdminInput(
    value.name as string,
    value.email as string,
    value.password as string,
    value.passwordConfirmation as string,
  );
}

async function interactiveInput(databaseName: string, confirmInTerminal: boolean): Promise<AdminInput> {
  if (!process.stdin.isTTY) throw new Error("Interactive mode requires a terminal.");
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, done) {
      if (!muted) process.stdout.write(chunk);
      done();
    },
  });
  const prompt = createInterface({ input: process.stdin, output, terminal: true });
  const hidden = async (label: string): Promise<string> => {
    process.stdout.write(label);
    muted = true;
    try {
      return await prompt.question("");
    } finally {
      muted = false;
      process.stdout.write("\n");
    }
  };
  try {
    if (confirmInTerminal) {
      const confirmation = await prompt.question(`Type ${databaseName} to confirm the target database: `);
      assertDatabaseTarget(configuredDatabaseUrl(), databaseName, confirmation);
    }
    const name = await prompt.question("Admin display name: ");
    const email = await prompt.question("Admin email: ");
    const password = await hidden("Admin password: ");
    const passwordConfirmation = await hidden("Confirm Admin password: ");
    return prepareAdminInput(name, email, password, passwordConfirmation);
  } finally {
    prompt.close();
  }
}

async function main(): Promise<void> {
  const args = parseCreateAdminArgs(process.argv.slice(2));
  const connectionString = configuredDatabaseUrl();
  const client = new pg.Client({ connectionString });
  let connected = false;
  let inTransaction = false;
  try {
    await client.connect();
    connected = true;
    const identity = await client.query<{ name: string }>("SELECT current_database() AS name");
    const databaseName = identity.rows[0]?.name;
    if (!databaseName) throw new Error("Connected database name does not match DATABASE_URL.");
    process.stdout.write(`Target database: ${databaseName}\n`);

    let input: AdminInput;
    if (args.confirmedDatabase) {
      assertDatabaseTarget(connectionString, databaseName, args.confirmedDatabase);
      input = args.stdinJson
        ? await readScriptedInput()
        : await interactiveInput(databaseName, false);
    } else {
      input = await interactiveInput(databaseName, true);
    }

    const passwordHash = await hashPassword(input.password);
    await client.query("BEGIN");
    inTransaction = true;
    const existing = await client.query("SELECT 1 FROM users WHERE email = $1", [input.email]);
    assertNewUser(existing.rowCount !== 0);
    await client.query(
      `INSERT INTO users (id, name, email, "passwordHash", role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'admin', now(), now())`,
      [randomUUID(), input.name, input.email, passwordHash],
    );
    await client.query("COMMIT");
    inTransaction = false;
    process.stdout.write("Admin account created.\n");
  } catch (error) {
    if (inTransaction) await client.query("ROLLBACK").catch(() => undefined);
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new Error("An account with this email already exists; no account was changed.");
    }
    throw error;
  } finally {
    if (connected) await client.end().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error && (SAFE_ERRORS.has(error.message) || error instanceof AppError)
    ? error.message
    : "Admin creation failed; check the database connection and schema.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
