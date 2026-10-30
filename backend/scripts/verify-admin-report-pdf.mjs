import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const url = new URL(process.env.DATABASE_URL ?? "");
if (!/^\/travelmate_scratch_\d{8}[a-z]$/.test(url.pathname)) throw new Error("Scratch database required");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH);
const pool = new pg.Pool({ connectionString: url.toString() });
const output = resolve("../docs/freeze-plan/admin-report/headless");
mkdirSync(output, { recursive: true });
const base = "http://localhost:5056/api";
const email = `pdf-${randomBytes(8).toString("hex")}@travelmate.test`;
const password = randomBytes(24).toString("base64url") + "Aa1!";
let browser;
let page;
const responses = [];
try {
  const registration = await fetch(base + "/auth/register", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Scratch PDF Admin", email, password }) });
  if (registration.status !== 201) throw new Error("Scratch registration failed");
  const updated = await pool.query('UPDATE users SET role=$1 WHERE email=$2', ["admin", email]);
  if (updated.rowCount !== 1) throw new Error("Scratch role setup failed");
  browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("response", response => { if(response.url().includes("/api/")) responses.push({url:response.url(),status:response.status()}); });
  await page.goto("http://localhost:5175/admin/report/print");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  const reportResponse = page.waitForResponse(r => r.url().endsWith("/api/admin/reports/catalog") && r.status() === 200);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const report = (await (await reportResponse).json()).data;
  await page.getByRole("heading", { name: "Catalogue coverage" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const text = await page.locator(".print-document").innerText();
  if (/[^\s@]+@[^\s@]+\.[^\s@]+|\b(?:userId|adminUserId)\b|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/iu.test(text)) throw new Error("Account identifier in print view");
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: resolve(output, "admin-report.pdf"), format: "A4", preferCSSPageSize: true,
    printBackground: true, margin: { top: "16mm", right: "16mm", bottom: "16mm", left: "16mm" } });
  writeFileSync(resolve(output, "expected.json"), JSON.stringify({ generatedLabel: text.match(/Generated[^\n]+/u)?.[0],
    generatedAt: report.generatedAt, totals: report.totals, byDestination: report.byDestination.map(({name,discoverable,archived})=>({name,discoverable,archived})),
    byCategory: report.byCategory, auditSummary: report.auditSummary,
    pdfOptions: { format: "A4", printBackground: true, preferCSSPageSize: true, margins: "16mm" } }, null, 2));
  console.log(JSON.stringify({ output, totals: report.totals, generatedAt: report.generatedAt }));
} catch (error) {
  console.error(JSON.stringify({url:page?.url(),responses,visibleText:await page?.locator("body").innerText()}));
  throw error;
} finally { await browser?.close(); await pool.end(); }
