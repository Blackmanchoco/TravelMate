import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('admin header keeps the account shell and hides traveller navigation', async () => {
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    plugins: [{
      name: 'test-header-auth',
      enforce: 'pre',
      load(id) {
        if (id.replaceAll('\\', '/').endsWith('/src/hooks/useAuth.ts')) {
          return 'export function useAuth() { return globalThis.__headerTestAuth; }';
        }
      },
    }],
  });
  try {
    const Header = (await vite.ssrLoadModule('/src/components/layout/Header.tsx')).default;
    const render = (role) => {
      globalThis.__headerTestAuth = {
        isAuthenticated: true,
        user: { id: 1, name: 'Test Person', email: 'test@travelmate.test', role },
        logout() {},
      };
      return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Header)));
    };
    const admin = render('admin');
    assert.match(admin, /<a[^>]+href="\/admin"[^>]*>.*?TravelMate/s);
    assert.match(admin, /<a\b(?=[^>]*href="\/admin")(?=[^>]*class="rounded-full bg-tint px-4 py-2 text-sm font-semibold text-accent")[^>]*>Admin<\/a>/);
    assert.match(await readFile(new URL('../../src/components/layout/Header.tsx', import.meta.url), 'utf8'), /isAdmin && <Link[^>]*to="\/admin"[^>]*>[\s\S]*?Admin console/);
    for (const label of ['Home', 'Explore', 'AI Assistant', 'Itinerary', 'Saved Places']) {
      assert.doesNotMatch(admin, new RegExp(`>${label}<`));
    }
    const traveller = render('user');
    assert.match(traveller, /<a[^>]+href="\/"[^>]*>.*?TravelMate/s);
    for (const label of ['Home', 'Explore', 'AI Assistant', 'Itinerary', 'Saved Places']) {
      assert.match(traveller, new RegExp(`>${label}<`));
    }
    assert.doesNotMatch(traveller, /aria-label="Admin console"/);
    assert.doesNotMatch(traveller, /<a[^>]+href="\/admin"/);
    assert.doesNotMatch(traveller, />Admin</);
  } finally {
    delete globalThis.__headerTestAuth;
    await vite.close();
  }
});
