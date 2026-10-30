import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

export async function runIntegratedBrowserChecks({ base, prisma, token, user, out, assertEnvironment }) {
  assertEnvironment();
  const output = `${out}/browser`;
  mkdirSync(output, { recursive: true });
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
  const result = { checks: [], screenshots: [], externalRequestsBlocked: 0, browserClosed: false };
  const save = () => writeFileSync(`${output}/checks.json`, JSON.stringify(result, null, 2));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(({ token, user }) => {
      localStorage.setItem('travelmate_access_token', token);
      localStorage.setItem('travelmate_auth_user', JSON.stringify(user));
    }, { token, user });
    let brokenSource = null;
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) { result.externalRequestsBlocked++; return route.abort(); }
      if (brokenSource && url.pathname === brokenSource) return route.abort();
      if (url.pathname.endsWith('/weather')) return route.fulfill({ status: 503, contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: 'SCRATCH_WEATHER_OFFLINE', message: 'Offline verification fixture.' } }) });
      return route.continue();
    });
    const page = await context.newPage();
    async function screenshot(name) {
      await page.evaluate(() => document.fonts.ready);
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
        brokenPhotos: [...document.images].filter(img => !img.closest('.leaflet-container') && img.complete && img.naturalWidth === 0).length }));
      result.checks.push({ name, ...layout, pass: !layout.overflow && !layout.brokenPhotos });
      await page.screenshot({ path: `${output}/${name}.png`, fullPage: true }); result.screenshots.push(`${name}.png`); save();
      if (layout.overflow || layout.brokenPhotos) throw Error('BROWSER_LAYOUT_ASSERTION_FAILED');
    }
    for (const [index, query] of ['Kuala Lumpur Tower', 'KL tower', 'Menara Kuala Lumpur', 'Unlisted Midnight Observatory qzx'].entries()) {
      await page.goto(`${base}/explore`);
      await page.getByRole('textbox', { name: 'Search destinations', exact: true }).fill(query);
      await Promise.all([
        page.waitForResponse(response => {
          const url = new URL(response.url());
          return url.origin === base && url.pathname === '/api/destinations' && url.searchParams.get('search') === query;
        }),
        page.getByRole('button', { name: 'Search', exact: true }).click(),
      ]);
      if (index === 3) await page.getByText('No destinations match these filters.', { exact: true }).waitFor();
      else await page.getByRole('heading', { name: 'Kuala Lumpur', exact: true }).waitFor();
      await page.waitForFunction(expected => document.querySelectorAll('article').length === expected, index === 3 ? 0 : 1);
      await screenshot(`alias-${index}`);
      const cardCount = await page.locator('article').count();
      const pass = cardCount === (index === 3 ? 0 : 1);
      result.checks.push({ name: `alias-result-${index}`, cardCount, pass }); save();
      if (!pass) throw Error('BROWSER_ALIAS_ASSERTION_FAILED');
    }
    assertEnvironment();
    const places = await prisma.place.findMany({ where: { deletedAt: null, category: { not: 'Test' } } });
    for (const category of ['Accommodation', 'Restaurant', 'Attraction', 'Culture', 'Historical', 'Nature', 'Shopping']) {
      const place = places.find(row => row.category === category && !row.imageUrl);
      if (!place) throw Error('BROWSER_PLACEHOLDER_FIXTURE_MISSING');
      await page.goto(`${base}/destinations/${place.destinationId}/places/${place.id}`);
      await page.getByRole('img', { name: `${place.name}: ${category} placeholder, no photo`, exact: true }).waitFor();
      await screenshot(`placeholder-${category.toLowerCase()}`);
    }
    const photo = places.find(row => row.name === 'Petronas Twin Towers' && row.imageUrl?.startsWith('/'));
    if (!photo) throw Error('BROWSER_IMAGE_ERROR_FIXTURE_MISSING');
    brokenSource = photo.imageUrl;
    await page.goto(`${base}/destinations/${photo.destinationId}/places/${photo.id}`);
    await page.getByRole('img', { name: `${photo.name}: ${photo.category} placeholder, no photo`, exact: true }).waitFor();
    await screenshot('placeholder-load-error');
    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot('placeholder-mobile');
    await page.goto(`${base}/explore?search=KL%20tower`);
    await page.getByRole('heading', { name: 'Kuala Lumpur', exact: true }).waitFor();
    await screenshot('alias-mobile');
    return result;
  } finally {
    if (browser) await browser.close();
    result.browserClosed = true; save();
  }
}
