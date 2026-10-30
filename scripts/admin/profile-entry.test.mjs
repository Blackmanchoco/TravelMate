import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { test } from 'node:test';
import { createServer } from 'vite';

test('profile keeps traveller content and gives admins a focused account header', async (t) => {
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    plugins: [{
      name: 'test-profile-role-render',
      enforce: 'pre',
      load(id) {
        const path = id.replaceAll('\\', '/');
        if (/\/src\/hooks\/useAuth\.tsx?$/.test(path)) {
          return 'export function useAuth() { return globalThis.__profileTestAuth; }';
        }
        if (/\/src\/hooks\/useUserPreferences\.tsx?$/.test(path)) {
          return 'export function useUserPreferences() { return { preferences: null, isLoading: false, loadError: null, refresh() {} }; }';
        }
        if (/\/src\/context\/SavedPlacesContext\.tsx?$/.test(path)) {
          return 'export function useSavedPlaces() { return { savedPlaces: [], pagination: { total: 0 }, isLoading: false, loadError: null, mutationError: null, refreshSavedPlaces() {}, removePlace() {}, isRemovingPlace: false, clearMutationError() {} }; }';
        }
        if (/\/src\/context\/ItineraryContext\.tsx?$/.test(path)) {
          return 'export function useItinerary() { return { itineraries: [], pagination: { total: 0 }, isLoading: false, loadError: null, refreshItineraries() {}, selectItinerary() { return true; } }; }';
        }
        const markers = {
          '/src/components/profile/StatisticsGrid.tsx': 'TRAVELLER_SAVED_DATA_COUNTS',
          '/src/components/profile/TravelPreferences.tsx': 'TRAVELLER_PREFERENCES',
          '/src/components/profile/FavoriteDestinations.tsx': 'TRAVELLER_FAVORITES',
          '/src/components/profile/UpcomingTrips.tsx': 'TRAVELLER_UPCOMING_TRIPS',
          '/src/components/profile/AccountSettingsCard.tsx': 'TRAVELLER_ACCOUNT_SETTINGS',
        };
        for (const [suffix, marker] of Object.entries(markers)) {
          if (path.endsWith(suffix)) return `export function ${suffix.split('/').at(-1).replace('.tsx', '')}() { return ${JSON.stringify(marker)}; }`;
        }
      },
    }],
  });

  try {
    const Profile = (await vite.ssrLoadModule('/src/pages/Profile.tsx')).default;
    const render = (role) => {
      globalThis.__profileTestAuth = {
        user: { id: 1, name: 'Test Person', email: `${role}@travelmate.test`, role, avatar: null, createdAt: '2025-10-21T00:00:00Z' },
        logout() {},
      };
      return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Profile)));
    };

    await t.test('admin sees account details and admin console only', () => {
      const admin = render('admin');
      assert.match(admin, /<h1[^>]*>Test Person<\/h1>/);
      assert.match(admin, /admin@travelmate\.test.*Admin/);
      assert.match(admin, /Joined October 2025/);
      assert.match(admin, /href="\/account-settings"[^>]*>.*Edit profile/);
      assert.match(admin, /href="\/admin"[^>]*>.*Open admin console/);
      assert.doesNotMatch(admin, /View itineraries/);
      for (const marker of ['TRAVELLER_SAVED_DATA_COUNTS', 'TRAVELLER_PREFERENCES', 'TRAVELLER_FAVORITES', 'TRAVELLER_UPCOMING_TRIPS', 'TRAVELLER_ACCOUNT_SETTINGS']) {
        assert.doesNotMatch(admin, new RegExp(marker));
      }
    });

    await t.test('traveller retains the original profile and no admin link', () => {
      const traveller = render('user');
      assert.match(traveller, /<h1[^>]*>Test Person<\/h1>/);
      assert.match(traveller, /user@travelmate\.test/);
      assert.match(traveller, /Joined October 2025/);
      assert.match(traveller, /href="\/account-settings"[^>]*>.*Edit profile/);
      assert.match(traveller, /href="\/itinerary"[^>]*>.*View itineraries/);
      for (const marker of ['TRAVELLER_SAVED_DATA_COUNTS', 'TRAVELLER_PREFERENCES', 'TRAVELLER_FAVORITES', 'TRAVELLER_UPCOMING_TRIPS', 'TRAVELLER_ACCOUNT_SETTINGS']) {
        assert.match(traveller, new RegExp(marker));
      }
      assert.doesNotMatch(traveller, /href="\/admin"|Admin console/);
    });
  } finally {
    delete globalThis.__profileTestAuth;
    await vite.close();
  }
});
