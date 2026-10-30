import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const root = 'C:/FYP/travelmate-admin-entry-profile';
const database = 'travelmate_scratch_20261019_finalalias';
const output = `${root}/docs/freeze-plan/admin-entry-profile-20261021`;
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
process.env.DOTENV_CONFIG_PATH = `${root}/.local-data/nonexistent-admin-entry-profile.env`;

const report = { database, checks: [], screenshots: [], errors: [] };
const check = (name, pass) => {
  report.checks.push({ name, pass });
  if (!pass) throw Error(`CHECK_FAILED_${name}`);
};
const save = () => {
  mkdirSync(output, { recursive: true });
  writeFileSync(`${output}/BROWSER_RESULTS.json`, `${JSON.stringify(report, null, 2)}\n`);
};
const redactEmails = async page => page.evaluate(() => {
  const pattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) node.textContent = node.textContent.replace(pattern, '[redacted email]');
});

let server;
let browser;
let prisma;
let client;
let stage = 'scratch-connect';
try {
  client = new Client({ connectionString: url.toString() });
  await client.connect();
  if ((await client.query('SELECT current_database() AS name')).rows[0].name !== database) throw Error('TARGET_GUARD');
  stage = 'backend-import';
  const { app } = await import(pathToFileURL(`${root}/backend/dist/app.js`).href);
  ({ prisma } = await import(pathToFileURL(`${root}/backend/dist/lib/prisma.js`).href));
  const { createBuiltApp } = await import(pathToFileURL(`${root}/scripts/demo/built-app.mjs`).href);
  server = await new Promise((resolve, reject) => {
    const instance = createBuiltApp(app, root).listen(5000, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  const base = 'http://127.0.0.1:5000';
  const password = `${randomBytes(20).toString('hex')}Aa1!`;
  async function register(name) {
    stage = 'scratch-register';
    const email = `admin-entry-${randomBytes(8).toString('hex')}@travelmate.test`;
    const response = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (response.status !== 201) throw Error('SCRATCH_REGISTRATION_FAILED');
    const body = await response.json();
    return { email, password, id: body.data.user.id };
  }
  const admin = await register('Scratch Admin');
  const traveller = await register('Scratch Traveller');
  await prisma.user.update({ where: { id: admin.id }, data: { role: 'admin' } });

  stage = 'browser-launch';
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  async function session(account, width, adminSession) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(`${base}/login`);
    await page.locator('input[type="email"]').fill(account.email);
    await page.locator('input[type="password"]').fill(account.password);
    const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/login'), { timeout: 10000 });
    await page.locator('form button[type="submit"]').click();
    const response = await loginResponse;
    if (response.status() !== 200) throw Error(`LOGIN_HTTP_${response.status()}`);
    await page.waitForURL(adminSession ? '**/admin' : '**/profile', { timeout: 10000 });
    return { context, page };
  }
  const screenshot = async (page, name) => {
    await redactEmails(page);
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    report.screenshots.push(`${name}.png`);
  };
  const goToAdminFrom = async (page, path, label) => {
    stage = `admin-${label}`;
    await page.goto(`${base}${path}`);
    await page.locator('header a[aria-label="Admin console"]').waitFor();
    check(`admin_link_from_${label}`, await page.locator('header a[aria-label="Admin console"]').getAttribute('href') === '/admin');
    await page.locator('header a[aria-label="Admin console"]').click();
    await page.waitForURL('**/admin', { timeout: 10000 });
    check(`admin_one_click_from_${label}`, new URL(page.url()).pathname === '/admin');
  };

  stage = 'admin-desktop';
  const desktopAdmin = await session(admin, 1280, true);
  await desktopAdmin.page.goto(`${base}/profile`);
  await desktopAdmin.page.getByRole('heading', { name: 'Scratch Admin' }).waitFor();
  await desktopAdmin.page.locator('header a[aria-label="Admin console"]').waitFor();
  check('admin_profile_console_action', await desktopAdmin.page.locator('a[href="/admin"]').filter({ hasText: 'Open admin console' }).count() === 1);
  check('admin_profile_role_text', await desktopAdmin.page.getByText(`${admin.email} · Admin`, { exact: true }).count() === 1);
  check('admin_header_link_keyboard_focusable', await desktopAdmin.page.locator('header a[aria-label="Admin console"]').evaluate(link => link.tabIndex === 0));
  await screenshot(desktopAdmin.page, 'admin-profile-desktop');
  for (const [path, label] of [['/profile', 'profile-desktop'], ['/itinerary', 'itinerary-desktop'], ['/history', 'history-desktop']]) {
    await goToAdminFrom(desktopAdmin.page, path, label);
  }
  await desktopAdmin.page.goto(`${base}/profile`);
  await desktopAdmin.page.locator('header button[aria-expanded]').click();
  const desktopAdminMenu = desktopAdmin.page.getByText('Admin console', { exact: true });
  check('admin_desktop_account_menu', await desktopAdminMenu.count() === 1 && await desktopAdminMenu.getAttribute('href') === '/admin');
  await desktopAdminMenu.click();
  await desktopAdmin.page.waitForURL('**/admin');
  check('admin_desktop_account_menu_link', new URL(desktopAdmin.page.url()).pathname === '/admin');
  await desktopAdmin.context.close();

  stage = 'admin-phone';
  const phoneAdmin = await session(admin, 390, true);
  await phoneAdmin.page.goto(`${base}/profile`);
  await phoneAdmin.page.locator('header a[aria-label="Admin console"]').waitFor();
  check('admin_phone_profile_console_action', await phoneAdmin.page.locator('a[href="/admin"]').filter({ hasText: 'Open admin console' }).count() === 1);
  await screenshot(phoneAdmin.page, 'admin-profile-phone');
  for (const [path, label] of [['/profile', 'profile-phone'], ['/itinerary', 'itinerary-phone'], ['/history', 'history-phone']]) {
    await goToAdminFrom(phoneAdmin.page, path, label);
  }
  await phoneAdmin.page.goto(`${base}/profile`);
  await phoneAdmin.page.getByRole('button', { name: 'Toggle account menu' }).click();
  const phoneAdminMenu = phoneAdmin.page.getByText('Admin console', { exact: true });
  check('admin_phone_account_menu', await phoneAdminMenu.count() === 1 && await phoneAdminMenu.getAttribute('href') === '/admin');
  await phoneAdminMenu.click();
  await phoneAdmin.page.waitForURL('**/admin');
  check('admin_phone_account_menu_link', new URL(phoneAdmin.page.url()).pathname === '/admin');
  await phoneAdmin.context.close();

  stage = 'traveller-desktop';
  const desktopTraveller = await session(traveller, 1280, false);
  await desktopTraveller.page.waitForSelector('h1');
  check('traveller_profile_original_sections', await desktopTraveller.page.getByText('Your saved data', { exact: true }).count() === 1
    && await desktopTraveller.page.getByText('View itineraries', { exact: true }).count() === 1);
  check('traveller_desktop_header_original', await desktopTraveller.page.locator('header nav a').count() === 5
    && await desktopTraveller.page.locator('header a[href="/admin"]').count() === 0);
  await screenshot(desktopTraveller.page, 'traveller-profile-desktop');
  for (const [path, label] of [['/profile', 'profile-desktop'], ['/itinerary', 'itinerary-desktop'], ['/history', 'history-desktop']]) {
    await desktopTraveller.page.goto(`${base}${path}`);
    check(`traveller_no_admin_${label}`, await desktopTraveller.page.locator('header a[href="/admin"]').count() === 0
      && await desktopTraveller.page.locator('header nav a').count() === 5);
  }
  await desktopTraveller.page.goto(`${base}/profile`);
  await desktopTraveller.page.locator('header button[aria-expanded]').click();
  check('traveller_desktop_account_menu_no_admin', await desktopTraveller.page.getByText('Admin console', { exact: true }).count() === 0);
  await desktopTraveller.context.close();

  stage = 'traveller-phone';
  const phoneTraveller = await session(traveller, 390, false);
  await phoneTraveller.page.waitForSelector('h1');
  check('traveller_phone_profile_original', await phoneTraveller.page.getByText('View itineraries', { exact: true }).count() === 1);
  check('traveller_phone_no_admin_link', await phoneTraveller.page.locator('header a[href="/admin"]').count() === 0);
  await screenshot(phoneTraveller.page, 'traveller-profile-phone');
  for (const [path, label] of [['/profile', 'profile-phone'], ['/itinerary', 'itinerary-phone'], ['/history', 'history-phone']]) {
    await phoneTraveller.page.goto(`${base}${path}`);
    check(`traveller_no_admin_${label}`, await phoneTraveller.page.locator('header a[href="/admin"]').count() === 0);
  }
  await phoneTraveller.page.goto(`${base}/profile`);
  await phoneTraveller.page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  check('traveller_phone_account_menu_no_admin', await phoneTraveller.page.getByText('Admin console', { exact: true }).count() === 0);
  await phoneTraveller.context.close();

  save();
  console.log(JSON.stringify({ checks: report.checks.length, passed: report.checks.filter(row => row.pass).length,
    failed: report.checks.filter(row => !row.pass).length, screenshots: report.screenshots }));
} catch (error) {
  report.errors.push({ stage, type: error.constructor?.name ?? 'Error', message: String(error.message).split('\n')[0].replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').replace(/https?:\/\/\S+/gi, '[redacted URL]').slice(0, 120) });
  save();
  console.log(`STOP ${stage}: ${report.errors[0].message}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await new Promise(resolve => server.close(resolve));
  if (prisma) await prisma.$disconnect().catch(() => {});
  if (client) await client.end().catch(() => {});
  delete process.env.DATABASE_URL;
  delete process.env.JWT_SECRET;
}
