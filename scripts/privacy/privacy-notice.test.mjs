import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let vite;
let App;
let PrivacyNotice;
let Register;
let AccountSettings;

function expectMatch(value, pattern, message) {
  assert.ok(pattern.test(value), message);
}

before(async () => {
  vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
    plugins: [{
      name: "privacy-notice-test-session",
      enforce: "pre",
      load(id) {
        const path = id.replaceAll("\\", "/");
        if (/\/src\/hooks\/useAuth\.(?:ts|tsx)$/.test(path)) {
          return "export function useAuth() { return globalThis.__privacyNoticeTestAuth; }";
        }
        if (/\/src\/hooks\/useUserPreferences\.(?:ts|tsx)$/.test(path)) {
          return "export function useUserPreferences() { return globalThis.__privacyNoticeTestPreferences; }";
        }
      },
    }],
  });

  PrivacyNotice = (await vite.ssrLoadModule("/src/pages/PrivacyNotice.tsx")).default;
  Register = (await vite.ssrLoadModule("/src/pages/Register.tsx")).default;
  AccountSettings = (await vite.ssrLoadModule("/src/pages/AccountSettings.tsx")).default;
  App = (await vite.ssrLoadModule("/src/App.tsx")).default;
});

after(async () => {
  delete globalThis.__privacyNoticeTestAuth;
  delete globalThis.__privacyNoticeTestPreferences;
  await vite?.close();
});

function render(Component, path = "/") {
  return renderToStaticMarkup(createElement(
    MemoryRouter,
    { initialEntries: [path] },
    createElement(Component),
  ));
}

test("Privacy Notice renders the required project, data, service, and device disclosures", () => {
  const html = render(PrivacyNotice);

  expectMatch(html, /<h1[^>]*>Privacy Notice<\/h1>/, "The page must render the Privacy Notice h1.");
  for (const heading of ["Who we are", "What we collect", "AI assistant", "External services", "On your device", "Your choices"]) {
    assert.ok(html.includes(`>${heading}</h2>`), `Missing section heading: ${heading}`);
  }

  for (const disclosure of [
    "INTI International College Penang",
    "6001CEM",
    "Goay Wei Jun",
    "travelmate@gmail.com",
    "bcrypt hash",
    "dietary preferences",
    "free-text notes you type",
    "configured TravelMate API server",
    "server address depends on deployment configuration",
    "Ollama",
    "127.0.0.1:11434",
    "for each request",
    "looks up catalogue places or uses personalized recommendations, relevant place results may also be sent to Ollama",
    "OpenStreetMap",
    "OpenWeatherMap",
    "latitude and longitude",
    "avatar image URL",
    "fonts are served from travelMate",
    "local app assets",
    "does not set cookies",
    "local storage",
    "request deletion",
  ]) {
    assert.ok(html.toLowerCase().includes(disclosure.toLowerCase()), `Missing disclosure: ${disclosure}`);
  }
});

test("/privacy renders publicly through the main layout and the footer links to it", () => {
  globalThis.__privacyNoticeTestAuth = { isAuthenticated: false, user: null, logout() {} };
  const html = render(App, "/privacy");

  expectMatch(html, /<h1[^>]*>Privacy Notice<\/h1>/, "The public route must render the notice.");
  expectMatch(html, /<footer[\s\S]*href="\/privacy"[^>]*>Privacy Notice<\/a>/, "The main layout footer must link to the notice.");
});

test("registration starts with required Privacy Notice consent unchecked and submission disabled", () => {
  globalThis.__privacyNoticeTestAuth = { register: async () => undefined };
  const html = render(Register, "/register");
  const checkbox = html.match(/<input\b[^>]*id="privacy-notice-consent"[^>]*>/)?.[0] ?? "";

  expectMatch(checkbox, /type="checkbox"/, "Consent must be a checkbox.");
  expectMatch(checkbox, /required=""/, "Consent must be required.");
  assert.doesNotMatch(checkbox, /checked=""/);
  expectMatch(html, /aria-labelledby="privacy-notice-consent-label privacy-notice-link"/, "Checkbox must have an accessible name.");
  expectMatch(html, /<a id="privacy-notice-link"[^>]*href="\/privacy"[^>]*>Privacy Notice<\/a>/, "Checkbox label must link to /privacy.");
  expectMatch(html, /<button type="submit" disabled=""[^>]*>/, "Submit must start disabled until the box is checked.");
});

test("Account Settings shows the Your data section, notice link, and deletion-request contact", () => {
  globalThis.__privacyNoticeTestAuth = {
    user: { id: "privacy-test-user", name: "Test User", email: "privacy-test@travelmate.test", role: "user", avatar: null, createdAt: "2026-10-28T00:00:00.000Z" },
    updateUser: async () => undefined,
  };
  globalThis.__privacyNoticeTestPreferences = {
    preferences: null,
    isLoading: false,
    isSaving: false,
    loadError: null,
    saveError: null,
    refresh: async () => undefined,
    save: async () => undefined,
  };
  const html = render(AccountSettings, "/account-settings");

  expectMatch(html, /<h2 id="your-data-heading"[^>]*>Your data<\/h2>/, "Account Settings must render Your data.");
  expectMatch(html, /href="\/privacy"[^>]*>\s*Privacy Notice\s*<\/a>/, "Your data must link to the notice.");
  assert.ok(html.includes("To request deletion of your account and associated data, contact travelmate@gmail.com."));
});
