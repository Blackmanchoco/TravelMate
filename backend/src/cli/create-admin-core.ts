import { normalizeEmail, validateEmail, validatePassword } from "../modules/auth/auth-credentials.js";

export type AdminInput = { name: string; email: string; password: string };
export type CreateAdminArgs = { confirmedDatabase?: string; stdinJson: boolean };

export function parseCreateAdminArgs(args: string[]): CreateAdminArgs {
  let confirmedDatabase: string | undefined;
  let stdinJson = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--confirm-database" && !confirmedDatabase) {
      confirmedDatabase = args[++index];
      if (!confirmedDatabase || confirmedDatabase.startsWith("--")) {
        throw new Error("--confirm-database requires an exact database name.");
      }
    } else if (arg === "--stdin-json" && !stdinJson) {
      stdinJson = true;
    } else {
      throw new Error("Unknown or repeated Admin setup option.");
    }
  }
  if (stdinJson && !confirmedDatabase) {
    throw new Error("--stdin-json requires --confirm-database.");
  }
  return { confirmedDatabase, stdinJson };
}

export function assertDatabaseTarget(
  connectionString: string,
  connectedName: string,
  confirmedName: string,
): void {
  let configuredName: string;
  try {
    const url = new URL(connectionString);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Wrong protocol");
    configuredName = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL.");
  }
  if (!configuredName || configuredName !== connectedName) {
    throw new Error("Connected database name does not match DATABASE_URL.");
  }
  if (confirmedName !== connectedName) {
    throw new Error("Database confirmation did not match the connected database name.");
  }
}

export function prepareAdminInput(
  name: string,
  email: string,
  password: string,
  passwordConfirmation: string,
): AdminInput {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > 100) {
    throw new Error("Name is required and must be at most 100 characters.");
  }
  const normalizedEmail = normalizeEmail(email);
  validateEmail(normalizedEmail);
  validatePassword(password);
  if (password !== passwordConfirmation) {
    throw new Error("Password confirmation does not match.");
  }
  return { name: trimmedName, email: normalizedEmail, password };
}

export function assertNewUser(existing: boolean): void {
  if (existing) {
    throw new Error("An account with this email already exists; no account was changed.");
  }
}
