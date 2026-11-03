# Scratch HTTP smoke — 2026-10-23

Branch: `integrate/deps-runner-20261023`

Source commit before recording this evidence: `8a33518fce2630a44d5168de83fab56507f333aa`

Server: built frontend and API served together on `127.0.0.1:2058`, assigned as a free port. The server verified the exact retained database `travelmate_scratch_20261023044730445` before serving requests. `DATABASE_URL` was overridden in process memory, and a connection guard rejected any pool target outside that scratch database. Generated credentials stayed in memory.

## Results

| Check | Result | Evidence |
|---|---|---|
| Python recommender warm-up | Pass | Exit 0, valid recommendation result, 1,911 ms. |
| Ollama warm-up | Pass | `npm run warm-ai` exit 0, 1,628 ms. |
| Authenticated recommendations | Pass | Two calls returned HTTP 200; each returned 5 items. |
| Explore destination search | Pass | `KL tower` returned exactly one result, place 37. |
| Assistant hotel question | Pass | HTTP 200, non-empty reply of 158 characters; `search_places` succeeded with 4 results. Reply text was not recorded. |
| Itinerary create and add | Pass | Created for 2026-11-01 through 2026-11-02; added place 37 on day 1 Morning and again on day 2 Afternoon; both item requests returned 201. |
| Admin authorization | Pass | `/api/admin/stats` returned 200 for the admin and 403 for the normal user. |
| Photo credits | Pass | `/images/credits.json` returned 200 with 47 entries; `/credits` returned 200. |
| Login rate limit | Pass | First 10 wrong-password attempts returned 401; attempt 11 returned 429 with `Retry-After: 599`; a different email still logged in with 200. |
| Security headers | Pass | API and frontend responses had `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`; `X-Powered-By` was absent. |
| Headless browser | Not available | Playwright, Playwright Chromium, and the Playwright CLI were not installed. No screenshots were produced. |
| Server shutdown | Pass | Server stopped; port 2058 had no listener. |

Synthetic users, their preference rows, and the itinerary were retained in the scratch database. No database rows or files were deleted.

## Backend test identification

With frontend `dist/index.html` absent, `backend/test/security-hardening.test.ts` test `sets the approved headers on API and served frontend responses` fails because the built-app fallback cannot serve the frontend and returns 404 where the test expects 200. This is recorded for reporting only; the test was not changed.
