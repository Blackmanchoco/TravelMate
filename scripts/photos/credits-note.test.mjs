import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('imported credits render their notes and preserve author text', async () => {
  const credits = JSON.parse(readFileSync(new URL('../../public/images/credits.json', import.meta.url), 'utf8'));
  const selected = credits.filter((credit) => [
    '/images/places/jen-penang-georgetown-by-shangri-la.jpg',
    '/images/places/batu-ferringhi-beach.jpg',
  ].includes(credit.file));
  assert.equal(selected.length, 2);
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    plugins: [{
      name: 'test-photo-credit-data',
      enforce: 'pre',
      load(id) {
        if (id.replaceAll('\\', '/').endsWith('/src/hooks/usePhotoCredits.ts')) {
          return `export function usePhotoCredits() { return { credits: ${JSON.stringify(selected)}, error: false }; }`;
        }
      },
    }],
  });
  try {
    const Page = (await vite.ssrLoadModule('/src/pages/PhotoCredits.tsx')).default;
    const html = renderToStaticMarkup(createElement(Page));
    assert.match(html, /CC BY-SA 4\.0<\/a> Resized and converted for web display; no other changes\. Photographed in 2017; the hotel was then branded Hotel Jen\./);
    assert.match(html, /Photo by <bdi dir="auto">\*angys\*<\/bdi>/);
    assert.match(html, /Photo by <bdi dir="auto">غریبه ای در شهر<\/bdi>/);
  } finally {
    await vite.close();
  }
});
