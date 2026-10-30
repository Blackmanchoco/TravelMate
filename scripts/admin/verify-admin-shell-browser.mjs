// One-time browser check against the retained exact-name v7 scratch database.
// Creates two random scratch-only accounts; never connects to demo or main.
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createBuiltApp } from '../demo/built-app.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url)).replaceAll('\\', '/').replace(/\/$/, '');
const database = 'travelmate_scratch_20261019_finalalias';
const output = `${root}/docs/freeze-plan/admin-shell-20261020`;
const require = createRequire(`${root}/backend/package.json`);
const { Client } = require('pg');
const source = readFileSync('C:/FYP/travelmate/backend/.env', 'utf8');
const line = source.split(/\r?\n/).find(value => /^DATABASE_URL=/.test(value));
if (!line) throw Error('SOURCE_SETTING_MISSING');
const url = new URL(line.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, ''));
if (!['postgres:', 'postgresql:'].includes(url.protocol)
  || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  || url.pathname !== '/travelmate'
  || [...url.searchParams.keys()].some(key => key !== 'schema')) throw Error('SOURCE_GUARD');
url.pathname = `/${database}`;
process.env.DATABASE_URL = url.toString();
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.JWT_EXPIRES_IN = '1h';
process.env.DOTENV_CONFIG_PATH = `${root}/.local-data/nonexistent-admin-shell.env`;
const report = { database, checks: [], screenshots: [], errors: [] };
const check = (name, pass) => { report.checks.push({ name, pass }); if (!pass) throw Error(`CHECK_FAILED_${name}`); };
const save = () => { mkdirSync(output, { recursive: true }); writeFileSync(`${output}/BROWSER_RESULTS.json`, `${JSON.stringify(report, null, 2)}\n`); };
let server;
let browser;
let prisma;
let client;
let activePage;
let stage = 'scratch-connect';
try {
  client = new Client({ connectionString: url.toString() });
  await client.connect();
  if ((await client.query('SELECT current_database() AS name')).rows[0].name !== database) throw Error('TARGET_GUARD');
  const baseline = await client.query(`SELECT (SELECT count(*)::int FROM users) AS users,
    (SELECT count(*)::int FROM places WHERE "deletedAt" IS NULL AND lower(btrim(category)) <> 'test') AS discoverable,
    (SELECT count(*)::int FROM places WHERE "imageUrl" IS NOT NULL AND "deletedAt" IS NULL AND lower(btrim(category)) <> 'test') AS photos`);
  check('scratch_v7_baseline', baseline.rows[0].users >= 2 && baseline.rows[0].discoverable === 56 && baseline.rows[0].photos === 43);
  stage = 'backend-import';
  const { app } = await import(pathToFileURL(`${root}/backend/dist/app.js`).href);
  ({ prisma } = await import(pathToFileURL(`${root}/backend/dist/lib/prisma.js`).href));
  server = await new Promise((resolve, reject) => {
    const instance = createBuiltApp(app, root).listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const password = `${randomBytes(20).toString('base64url')}Aa1!`;
  async function register(name) {
    stage = 'scratch-register';
    const email = `scratch-${randomBytes(8).toString('hex')}@travelmate.test`;
    const response = await fetch(`${base}/api/auth/register`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
    if (response.status !== 201) throw Error('SCRATCH_REGISTRATION_FAILED');
    const body = await response.json();
    return { email, password, id: body.data.user.id };
  }
  const adminAccount = await register('Scratch Admin');
  const travellerAccount = await register('Scratch Traveller');
  stage = 'scratch-promote';
  if (new URL(process.env.DATABASE_URL).pathname !== `/${database}`) throw Error('WRITE_TARGET_GUARD');
  await prisma.user.update({ where: { id: adminAccount.id }, data: { role: 'admin' } });
  stage = 'browser-launch';
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  async function session(account, width) {
    stage = `browser-login-${width}`;
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    activePage = page;
    await page.goto(`${base}/login`);
    await page.locator('input[type="email"]').fill(account.email);
    await page.locator('input[type="password"]').fill(account.password);
    const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/login'), { timeout: 10000 });
    await page.locator('form button[type="submit"]').click();
    const response = await loginResponse;
    if (response.status() !== 200) throw Error(`LOGIN_HTTP_${response.status()}`);
    await page.waitForURL(account === adminAccount ? '**/admin' : '**/profile', { timeout: 10000 });
    return { context, page };
  }
async function redactEmails(page) {
    await page.evaluate(() => {
      const pattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) node.textContent = node.textContent.replace(pattern, '[redacted]');
      document.querySelectorAll('input[type="email"]').forEach(input => { input.value = '[redacted]'; });
    });
  }
  async function screenshot(page, name) {
    await redactEmails(page);
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    report.screenshots.push(`${name}.png`);
    save();
  }
  const desktopAdmin = await session(adminAccount, 1280);
  stage = 'admin-desktop';
  const adminPage = desktopAdmin.page;
  await adminPage.locator('header [aria-label="Admin console"]').waitFor();
  check('admin_lands_on_admin', new URL(adminPage.url()).pathname === '/admin');
  check('admin_brand_target', await adminPage.locator('header a').first().getAttribute('href') === '/admin');
  check('admin_traveller_links_hidden', await adminPage.locator('header nav a').count() === 0);
  check('admin_sections_visible', await adminPage.locator('nav[aria-label="Admin sections"] button').count() === 5);
  check('admin_footer_credits', await adminPage.locator('footer a[href="/credits"]').count() === 1);
  await screenshot(adminPage, 'admin-desktop');
  await adminPage.goto(`${base}/explore`);
  await adminPage.locator('header [aria-label="Admin console"]').waitFor();
  check('admin_can_open_traveller_route', new URL(adminPage.url()).pathname === '/explore');
  await adminPage.goto(`${base}/admin`);
  stage = 'admin-report';
  const reportResponse = adminPage.waitForResponse(response => response.url().includes('/api/admin/report') && response.status() === 200);
  await adminPage.locator('nav[aria-label="Admin sections"]').getByRole('button', { name: 'Report' }).click();
  await reportResponse;
  check('admin_report_tab', await adminPage.locator('nav[aria-label="Admin sections"]').getByRole('button', { name: 'Report' }).count() === 1);
  await screenshot(adminPage, 'admin-report-desktop');
  await adminPage.goto(`${base}/admin/report/print`);
  stage = 'admin-print';
  await adminPage.getByRole('heading', { name: 'Catalogue coverage' }).waitFor();
  check('admin_print_view', await adminPage.getByRole('button', { name: 'Print / Save as PDF' }).isEnabled());
  await adminPage.screenshot({ path: `${output}/admin-print-desktop.png`, fullPage: true });
  report.screenshots.push('admin-print-desktop.png');
  await adminPage.goto(`${base}/admin`);
  await adminPage.locator('header button[aria-expanded]:visible').click();
  await adminPage.locator('header button:visible').filter({ hasText: 'Logout' }).click();
  await adminPage.waitForURL('**/login');
  check('admin_desktop_signout', await adminPage.evaluate(() => !localStorage.getItem('travelmate_access_token')));
  await desktopAdmin.context.close();

  const phoneAdmin = await session(adminAccount, 400);
  stage = 'admin-phone';
  await phoneAdmin.page.locator('header [aria-label="Admin console"]').waitFor();
  check('admin_phone_no_traveller_links', await phoneAdmin.page.locator('header nav a').count() === 0);
  await phoneAdmin.page.getByRole('button', { name: 'Toggle account menu' }).click();
  check('admin_phone_account_menu', await phoneAdmin.page.getByRole('button', { name: 'Logout' }).count() === 1);
  await screenshot(phoneAdmin.page, 'admin-phone');
  await phoneAdmin.page.getByRole('button', { name: 'Logout' }).click();
  await phoneAdmin.page.waitForURL('**/login');
  check('admin_phone_signout', await phoneAdmin.page.evaluate(() => !localStorage.getItem('travelmate_access_token')));
  await phoneAdmin.context.close();

  const desktopTraveller = await session(travellerAccount, 1280);
  stage = 'traveller-desktop';
  check('traveller_lands_on_profile', new URL(desktopTraveller.page.url()).pathname === '/profile');
  check('traveller_brand_target', await desktopTraveller.page.locator('header a').first().getAttribute('href') === '/');
  check('traveller_original_links', await desktopTraveller.page.locator('header nav a').count() === 5);
  check('traveller_no_admin', await desktopTraveller.page.locator('header [aria-label="Admin console"]').count() === 0
    && await desktopTraveller.page.locator('header a[href="/admin"]').count() === 0);
  await screenshot(desktopTraveller.page, 'traveller-desktop');
  await desktopTraveller.page.locator('header button[aria-expanded]:visible').click();
  await desktopTraveller.page.locator('header button:visible').filter({ hasText: 'Logout' }).click();
  await desktopTraveller.page.waitForURL('**/login');
  check('traveller_desktop_signout', await desktopTraveller.page.evaluate(() => !localStorage.getItem('travelmate_access_token')));
  await desktopTraveller.context.close();

  const phoneTraveller = await session(travellerAccount, 400);
  stage = 'traveller-phone';
  await phoneTraveller.page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  const travellerPaths = ['/', '/explore', '/ai-assistant', '/itinerary', '/saved-trips'];
  check('traveller_phone_links', (await Promise.all(travellerPaths.map(path =>
    phoneTraveller.page.locator(`header nav a[href="${path}"]:visible`).count()))).every(count => count === 1));
  check('traveller_phone_no_admin', await phoneTraveller.page.locator('header a[href="/admin"]').count() === 0);
  await screenshot(phoneTraveller.page, 'traveller-phone');
  await phoneTraveller.page.locator('header button:visible').filter({ hasText: 'Logout' }).click();
  await phoneTraveller.page.waitForURL('**/login');
  check('traveller_phone_signout', await phoneTraveller.page.evaluate(() => !localStorage.getItem('travelmate_access_token')));
  // Replace the earlier diagnostic failure image with a safe page from the passing run.
  await phoneTraveller.page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  await phoneTraveller.context.close();
  save();
  console.log(JSON.stringify({ checks: report.checks.length, passed: report.checks.filter(row => row.pass).length,
    screenshots: report.screenshots.length, database }));
} catch (error) {
  if (activePage) {
    report.failurePath = new URL(activePage.url()).pathname;
    report.visibleFormErrors = (await activePage.locator('form p').allTextContents().catch(() => []))
      .map(value => value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]').slice(0, 100));
    await redactEmails(activePage).catch(() => {});
    await activePage.addStyleTag({ content: 'input[type="email"] { color: transparent !important; }' }).catch(() => {});
    await activePage.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  }
  const message = String(error.message).split('\n')[0]
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/https?:\/\/\S+/gi, '[REDACTED_URL]').slice(0, 140);
  report.errors.push({ stage, type: error.constructor?.name ?? 'Error', message });
  save();
  console.log(`STOP ${stage}: ${message}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await new Promise(resolve => server.close(resolve));
  if (prisma) await prisma.$disconnect().catch(() => {});
  if (client) await client.end().catch(() => {});
  delete process.env.DATABASE_URL;
  delete process.env.JWT_SECRET;
}
