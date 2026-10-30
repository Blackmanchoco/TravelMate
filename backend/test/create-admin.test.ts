import { randomBytes } from "node:crypto";

import bcrypt from "bcrypt";
import { describe, expect, it } from "vitest";

import {
  hashPassword,
  normalizeEmail,
  validateEmail,
  validatePassword,
} from "../src/modules/auth/auth-credentials.js";
import {
  assertDatabaseTarget,
  assertNewUser,
  parseCreateAdminArgs,
  prepareAdminInput,
} from "../src/cli/create-admin-core.js";

const email = ["reviewer", "example.invalid"].join("@");
const password = randomBytes(20).toString("base64url");

describe("reviewer Admin account setup", () => {
  it("uses registration's email and password rules", () => {
    expect(normalizeEmail(`  ${email.toUpperCase()}  `)).toBe(email);
    expect(() => validateEmail(email)).not.toThrow();
    expect(() => validateEmail("invalid-address")).toThrow("Email must be valid.");
    expect(() => validatePassword("short"))
      .toThrow("Password must be at least 8 characters and no more than 72 UTF-8 bytes.");
    expect(() => validatePassword(password)).not.toThrow();
    expect(prepareAdminInput("Reviewer", email, password, password)).toEqual({
      name: "Reviewer",
      email,
      password,
    });
    expect(() => prepareAdminInput("Reviewer", email, password, "mismatch"))
      .toThrow("Password confirmation does not match.");
  });

  it("rejects passwords that exceed bcrypt's 72 UTF-8 byte limit", () => {
    expect(() => validatePassword("a".repeat(72))).not.toThrow();
    expect(() => validatePassword("a".repeat(73)))
      .toThrow("Password must be at least 8 characters and no more than 72 UTF-8 bytes.");
    expect(() => validatePassword("😀".repeat(18))).not.toThrow();
    expect(() => validatePassword("😀".repeat(19)))
      .toThrow("Password must be at least 8 characters and no more than 72 UTF-8 bytes.");
  });

  it("hashes with the same bcrypt cost as registration", async () => {
    const hash = await hashPassword(password);
    expect(hash.split("$")[2]).toBe("12");
    expect(await bcrypt.compare(password, hash)).toBe(true);
  });

  it("requires an exact confirmed database name, including names containing travelmate", () => {
    const url = new URL("postgresql://localhost:5432/travelmate_reviewer_tmp");
    expect(() => assertDatabaseTarget(url.toString(), "travelmate_reviewer_tmp", "travelmate_reviewer_tmp"))
      .not.toThrow();
    expect(() => assertDatabaseTarget(url.toString(), "travelmate_reviewer_tmp", "other_name"))
      .toThrow("Database confirmation did not match the connected database name.");
    expect(() => assertDatabaseTarget(url.toString(), "other_name", "other_name"))
      .toThrow("Connected database name does not match DATABASE_URL.");
  });

  it("rejects an existing account and invalid script flags", () => {
    expect(() => assertNewUser(true)).toThrow("An account with this email already exists; no account was changed.");
    expect(() => assertNewUser(false)).not.toThrow();
    expect(parseCreateAdminArgs(["--confirm-database", "reviewer_tmp", "--stdin-json"]))
      .toEqual({ confirmedDatabase: "reviewer_tmp", stdinJson: true });
    expect(() => parseCreateAdminArgs(["--stdin-json"]))
      .toThrow("--stdin-json requires --confirm-database.");
  });
});
